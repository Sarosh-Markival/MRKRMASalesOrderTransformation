/**
 * @NApiVersion 2.1
 */
define(['N/log', 'N/query', 'N/record', 'N/runtime', 'N/search', 'N/ui/serverWidget', './constants'],
    /**
     * @param{log} log
     * @param{query} query
     * @param{record} record
     * @param{runtime} runtime
     * @param{search} search
     * @param{serverWidget} serverWidget
     */
    (log, query, record, runtime, search, serverWidget, constants) => {

        const HELPERS = {
            /**
             * @param scriptContext
             * @return {null}
             */
            addSalesOrderButton: (scriptContext) => {
                let buttonObj = null;
                try {
                    let type = scriptContext.type;
                    let record = scriptContext.newRecord;
                    let recordType = record.type;
                    let id = record.id;
                    let status = record.getValue({fieldId: 'orderstatus'});
                    let avoidRefundStatuses = ['G', 'C', 'H']; //G=Refunded, C=Cancelled, H=Closed
                    log.debug('addSalesOrderButton', `type=${recordType}, recordId=${id} status=${status}`);
                    if (avoidRefundStatuses.includes(status)) return null;
                    if (type !== scriptContext.UserEventType.VIEW) return null;
                    let form = scriptContext.form;
                    form.clientScriptModulePath = './mrk_rma_so_transform_cs';
                    buttonObj = form.addButton({
                        id: constants.CONSTANTS.RMA.BUTTON.ID,
                        label: constants.CONSTANTS.RMA.BUTTON.LABEL,
                        functionName: constants.CONSTANTS.RMA.BUTTON.FUNCTION
                    });

                } catch (e) {
                    let err = `Error adding button: ${e.message} - ${e.stack}`;
                    log.error({title: 'addSalesOrderButton', details: err});
                } finally {
                    return buttonObj;
                }

            },

            /**
             * @param request
             * @return {{soId: string, success: boolean, hasPaymentMethod: boolean, message: string}}
             */
            createSalesOrder: (request) => {
                let resp = {success: false, message: '', soId: ''};
                try {
                    let body = JSON.parse(request.body);
                    let bodyFields = body.bodyFields || {};
                    let bodyFieldsKeys = Object.keys(bodyFields);
                    let lineItems = body.lineItems || {};
                    let lineIds = Object.keys(lineItems);
                    let lineItemsLength = lineIds.length;

                    if (bodyFieldsKeys.length == 0 || lineItemsLength == 0) throw new Error('Invalid request body');
                    let soRec = record.create({
                        type: record.Type.SALES_ORDER,
                        isDynamic: true
                    });
                    bodyFieldsKeys.forEach(key => {
                        let value = key == 'trandate' ? new Date(bodyFields[key]) : bodyFields[key];
                        log.debug('createSalesOrder:body', `key=${key}, value=${value}`)
                        soRec.setValue({
                            fieldId: key,
                            value: value
                        });
                    });

                    lineIds.forEach(line => {
                        let lineItem = lineItems[line];
                        soRec.selectNewLine({sublistId: 'item'});
                        let lineItemKeys = Object.keys(lineItem);
                        lineItemKeys.forEach(key => {
                            log.debug('createSalesOrder:lineItem', `key=${key}, value=${lineItem[key]}`);
                            soRec.setCurrentSublistValue({
                                sublistId: 'item',
                                fieldId: key,
                                value: lineItem[key]
                            });
                        });
                        soRec.commitLine({sublistId: 'item'});
                    });
                    //save the sales order
                    let soId = soRec.save({
                        enableSourcing: true,
                        ignoreMandatoryFields: true
                    });

                    resp.success = true;
                    resp.message = `Sales order with id=${soId} created successfully`;
                    resp.soId = soId;
                    log.audit('createSalesOrder', resp.message);


                } catch (e) {
                    let errorM = e.message + e.stack;
                    log.error('createSalesOrder', errorM);
                    resp.message = errorM;

                } finally {

                    return resp;
                }

            }


        }

        return {HELPERS}

    });
