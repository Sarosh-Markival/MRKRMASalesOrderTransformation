/**
 * @NApiVersion 2.1
 */

define(['N/https', 'N/log', 'N/query', 'N/record', 'N/runtime', 'N/search', 'N/ui/dialog', 'N/ui/message', 'N/url', 'N/currentRecord', './constants'],
    /**
     * @param{https} https
     * @param{log} log
     * @param{query} query
     * @param{record} record
     * @param{runtime} runtime
     * @param{search} search
     * @param{dialog} dialog
     * @param{message} message
     * @param{url} url
     * @param{currentRecord} currentRecord
     */
    (https, log, query, record, runtime, search, dialog, message, url, currentRecord, constants) => {

        let isSalesOrderCreationInProgress = false;
        const HELPERS = {
            createSalesOrder: async () => {
                let isCreated = false;
                try {
                    if (isSalesOrderCreationInProgress) {
                        alert('Sales Order Creation is in progress. Please wait until the process is complete.');
                        return isCreated;
                    }
                    let isConfirmed = await HELPERS.showSalesOrderCreationConfirmation();
                    let rmaCurrentRec = currentRecord.get();
                    if (isConfirmed) {
                        isSalesOrderCreationInProgress = true;
                        //async operation to create a sales order
                        let resp = await HELPERS.doAsyncOperation(async (resolve, reject) => {
                            let messageObj = null;
                            //load the RMA record
                            let rmaRecord = await record.load.promise({
                                type: record.Type.RETURN_AUTHORIZATION,
                                id: rmaCurrentRec.id
                            });
                            let returnTransaction = rmaRecord.getValue({fieldId: constants.CONSTANTS.FIELDS.TRANSACTION.BODY.RETURN_TRANSACTION});
                            //check if a sales order has already been created for this RMA
                            if (!!returnTransaction) {
                                messageObj = message.create({
                                    title: constants.CONSTANTS.MESSAGES.SALES_ORDER_EXISTS.TITLE,
                                    message: constants.CONSTANTS.MESSAGES.SALES_ORDER_EXISTS.MESSAGE,
                                    type: message.Type.ERROR
                                });
                                messageObj.show({duration: 5000});
                                resolve({
                                    success: false,
                                    message: constants.CONSTANTS.MESSAGES.SALES_ORDER_EXISTS.MESSAGE
                                });
                                return isCreated;
                            }
                            //get all items from the RMA
                            let {itemIds, itemsObj} = HELPERS.getAllItemsFromRma(rmaRecord);
                            //check if all items are in stock
                            messageObj = message.create({
                                title: constants.CONSTANTS.MESSAGES.CHECK_ITEMS_IN_STOCK.TITLE,
                                message: constants.CONSTANTS.MESSAGES.CHECK_ITEMS_IN_STOCK.MESSAGE,
                                type: message.Type.INFORMATION
                            });
                            messageObj.show();
                            let itemsStockAvailability = await HELPERS.checkIfAllLineItemsAreInStock(itemIds, itemsObj);
                            messageObj.hide();
                            let areAllItemsInStock = itemsStockAvailability.areAllItemsInStock;
                            let itemsNotInStock = itemsStockAvailability.itemsNotInStock;
                            //if all items are not in stock, show a message and return
                            if (!areAllItemsInStock) {
                                let oosMessage = constants.CONSTANTS.MESSAGES.OOS(itemsNotInStock);
                                messageObj = message.create({
                                    title: oosMessage.TITLE,
                                    message: oosMessage.MESSAGE,
                                    type: message.Type.ERROR
                                });
                                messageObj.show({duration: 5000});
                                resolve({success: false, message: oosMessage.MESSAGE});
                                return isCreated;
                            }

                            //if all items are in stock, create a sales order
                            messageObj = message.create({
                                title: constants.CONSTANTS.MESSAGES.SALES_ORDER_CREATION.TITLE,
                                message: constants.CONSTANTS.MESSAGES.SALES_ORDER_CREATION.MESSAGE,
                                type: message.Type.WARNING
                            });
                            messageObj.show();
                            //prepare sales order data
                            let salesOrderData = await HELPERS.prepareSalesOrderData(rmaRecord, itemsObj);
                            //create sales order
                            let salesOrderResponse = await HELPERS.createSalesOrderRequest(salesOrderData);
                            messageObj.hide();
                            //if sales order creation fails, show a message and return
                            if (!salesOrderResponse.success) {
                                let salesOrderCreationMessage = constants.CONSTANTS.MESSAGES.SALES_ORDER_CREATION_ERROR(salesOrderResponse.message);
                                messageObj = message.create({
                                    title: salesOrderCreationMessage.TITLE,
                                    message: salesOrderCreationMessage.MESSAGE,
                                    type: message.Type.ERROR
                                });
                                messageObj.show({duration: 5000});
                                resolve({success: false, message: salesOrderCreationMessage.MESSAGE});
                                return isCreated;
                            }
                            let salesOrderCreationMessage = constants.CONSTANTS.MESSAGES.SALES_ORDER_CREATED(salesOrderResponse.soId);
                            messageObj = message.create({
                                title: salesOrderCreationMessage.TITLE,
                                message: salesOrderCreationMessage.MESSAGE,
                                type: message.Type.CONFIRMATION
                            });
                            messageObj.show(5000);
                            resolve({
                                success: true,
                                message: salesOrderCreationMessage.MESSAGE,
                                salesOrderId: salesOrderResponse.soId
                            });
                            return true;
                        });
                        //if sales order is created, update the RMA record with the sales order id
                        isCreated = !!resp.success && !!resp.salesOrderId;
                        //update the RMA record with the sales order id
                        !!isCreated ? record.submitFields({
                            type: record.Type.RETURN_AUTHORIZATION,
                            id: rmaCurrentRec.id,
                            values: {
                                [constants.CONSTANTS.FIELDS.TRANSACTION.BODY.RETURN_TRANSACTION]: resp.salesOrderId,
                            },
                            options: {
                                enableSourcing: false,
                                ignoreMandatoryFields: true
                            }
                        }) : null;
                        //show a completion dialog
                        let completionDialogResponse = await dialog.alert({
                            title: 'Process Has Been Completed',
                            message: resp.message
                        });
                        //open the sales order in a new tab
                        if (completionDialogResponse && isCreated) {
                            let salesOrderUrl = url.resolveRecord({
                                recordType: record.Type.SALES_ORDER,
                                recordId: resp.salesOrderId,
                                isEditMode: false
                            });
                            window.open(salesOrderUrl, '_blank');
                        }
                    }
                } catch (e) {
                    let err = `Error in createSalesOrder: ${e.message} - ${e.stack}`;
                    log.error('createSalesOrder:e', err);
                    console.error(err);
                    message.create({
                        title: 'Error',
                        message: err,
                        type: message.Type.ERROR
                    }).show({duration: 5000});

                } finally {
                    isSalesOrderCreationInProgress = false;
                    return isCreated;

                }

            },
            showSalesOrderCreationConfirmation: async () => {
                let isConfirmed = false;
                try {
                    let dialogTitle = constants.CONSTANTS.MESSAGES.CONFIRMATION.TITLE
                    let dialogMessage = constants.CONSTANTS.MESSAGES.CONFIRMATION.MESSAGE;
                    let dialogOptions = {
                        title: dialogTitle,
                        message: dialogMessage
                    }
                    isConfirmed = await dialog.confirm(dialogOptions)
                } catch (e) {
                    let err = `Error in showSalesOrderCreationConfirmation: ${e.message} - ${e.stack}`;
                    log.error('showSalesOrderCreationConfirmation:e', err);
                    console.error(err);
                } finally {
                    return isConfirmed;
                }

            },
            checkIfAllLineItemsAreInStock: async (items, itemsObj) => {
                let itemStockAvailability = {areAllItemsInStock: false, itemsNotInStock: [], error: ''};
                try {
                    let itemLocationQuantityMap = await HELPERS.getItemLocationQuantity([...items]);
                    let itemIds = [...items];
                    let lineIds = Object.keys(itemsObj);
                    //loop through each item and check if it is in stock
                    lineIds.forEach(line => {
                        let itemObj = itemsObj[line];
                        let item = itemObj.item;
                        let locationId = itemObj.location;
                        let quantity = Number(itemObj.quantity) || 0;
                        let itemLocationKey = `${item}_${locationId}`;
                        let itemLocationObj = itemLocationQuantityMap[itemLocationKey];
                        let qtyAvailable = Number(itemLocationObj.qtyAvailable) || 0;
                        let qtyOnHand = Number(itemLocationObj.qtyOnHand) || 0;
                        if ((qtyAvailable < quantity) || (quantity == 0 && qtyAvailable == 0)) {
                            itemStockAvailability.itemsNotInStock.push({
                                item: itemLocationObj.item,
                                requiredQuantity: quantity,
                                availableQuantity: qtyAvailable,
                                onHandQuantity: qtyOnHand,
                                location: itemLocationObj.location
                            });
                        }
                    });
                    itemStockAvailability.areAllItemsInStock = itemStockAvailability.itemsNotInStock.length == 0;
                } catch (e) {
                    let err = `Error in checkIfAllLineItemsAreInStock: ${e.message} - ${e.stack}`;
                    log.error('checkIfAllLineItemsAreInStock:e', err);
                    console.error(err);
                    itemStockAvailability.error = err;
                } finally {
                    log.debug('itemStockAvailability', itemStockAvailability);
                    console.log('itemStockAvailability', itemStockAvailability);

                    return itemStockAvailability;

                }
            },
            getItemLocationQuantity: async (items) => {
                let itemIds = items;
                let itemLocationMap = {};
                let q = `SELECT 
                              BUILTIN.DF(al.item) as item, 
                              BUILTIN.DF(al.location) as location, 
                              al.item as itemId, 
                              al.location as locationId, 
                              al.quantityavailable as QtyAvailable, 
                              al.quantityonhand as QtyOnHand 
                            from 
                              aggregateItemLocation al 
                            where 
                              al.item in (${itemIds.map(id => `'${id}'`).join(',')})
                              `;
                let queryResponse = await query.runSuiteQL.promise({query: q});
                let queryResults = queryResponse.asMappedResults();
                queryResults.forEach(result => {
                    let item = result.item;
                    let location = result.location;
                    let itemId = result.itemid;
                    let locationId = result.locationid;
                    let qtyAvailable = result.qtyavailable;
                    let qtyOnHand = result.qtyonhand;
                    let itemLocationKey = `${itemId}_${locationId}`;
                    let itemLocationObj = {
                        item,
                        location,
                        itemId,
                        locationId,
                        qtyAvailable,
                        qtyOnHand
                    }
                    itemLocationMap[itemLocationKey] = itemLocationObj;
                });
                log.audit('itemLocationMap', JSON.stringify(itemLocationMap));
                return itemLocationMap;

            },

            /**
             *
             * @param rmaRecord
             * @return {{itemIds: Set<any>, itemsObj: {}}}
             */
            getAllItemsFromRma: (rmaRecord) => {
                let rmaLineItemCount = rmaRecord.getLineCount({sublistId: 'item'});
                let itemsObj = {};
                let itemIds = new Set();
                //get all items from rma
                for (let i = 0; i < rmaLineItemCount; i++) {
                    let itemId = rmaRecord.getSublistValue({
                        sublistId: 'item',
                        fieldId: 'item',
                        line: i
                    });
                    let location = rmaRecord.getSublistValue({
                        sublistId: 'item',
                        fieldId: 'location',
                        line: i
                    });
                    let quantity = rmaRecord.getSublistValue({
                        sublistId: 'item',
                        fieldId: 'quantity',
                        line: i
                    });
                    let lineId = rmaRecord.getSublistValue({sublistId: 'item', fieldId: 'line', line: i});
                    let itemObj = {
                        item: itemId,
                        location: location,
                        quantity: quantity,
                        price: -1,
                        rate: 0,
                        amount: 0,

                    }
                    itemsObj[lineId] = itemObj;
                    itemIds.add(itemId);
                }
                return {itemsObj, itemIds};
            },

            createSalesOrderRequest: async (data) => {
                let salesOrderResponse = {success: false, message: '', soId: ''};
                try {
                    let suiteletUrl = url.resolveScript({
                        scriptId: constants.CONSTANTS.SCRIPTS.SUITELET.SCRIPT_ID,
                        deploymentId: constants.CONSTANTS.SCRIPTS.SUITELET.DEPLOYMENT_ID,
                        returnExternalUrl: false
                    });
                    let action = constants.CONSTANTS.SCRIPTS.SUITELET.ACTIONS.CREATE_SALES_ORDER;
                    let suiteletUrlWithParams = `${suiteletUrl}&action=${action}`;
                    let suiteletResponse = await https.post.promise({
                        url: suiteletUrlWithParams,
                        body: JSON.stringify(data),
                    });
                    let suiteletResponseBody = JSON.parse(suiteletResponse.body);
                    salesOrderResponse.success = suiteletResponseBody.success;
                    salesOrderResponse.message = suiteletResponseBody.message;
                    salesOrderResponse.soId = suiteletResponseBody.soId;
                    console.log('suiteletResponseBody', suiteletResponseBody);


                } catch (e) {
                    let err = `
                    Error in createSalesOrderRequest
                : ${e.message}
                    - ${e.stack}`;
                    log.error('createSalesOrderRequest:e', err);
                    console.error(err);
                    salesOrderResponse.message = err;
                } finally {
                    return salesOrderResponse;

                }


            },

            /**
             *
             * @param rmaRecord
             * @param items
             * @return {Promise<{bodyFields: {shipmetod: *, rma, shipaddress: *, billaddresslist: *, location: *, shippingcost: number, entity: *, subsidiary: *}, items}>}
             */
            prepareSalesOrderData: async (rmaRecord, items) => {
                let createdFrom = rmaRecord.getValue({fieldId: 'createdfrom'});
                if (!createdFrom) throw new Error('No Sales Order or Invoice is associated with this RMA');
                let createdFromData = await HELPERS.getCreatedFromData(rmaRecord.getValue('createdfrom'));
                let defaultBodyFields = constants.CONSTANTS.DEFAULTS.SALES_ORDER.BODY;
                let bodyFields = {
                    entity: rmaRecord.getValue({fieldId: 'entity'}),
                    subsidiary: rmaRecord.getValue({fieldId: 'subsidiary'}),
                    location: rmaRecord.getValue({fieldId: 'location'}),
                    [constants.CONSTANTS.FIELDS.TRANSACTION.BODY.RETURN_TRANSACTION]: rmaRecord.id,
                    shipmetod: createdFromData.shippingmethodid,
                    shipaddresslist: createdFromData.shipaddresslist,
                    billaddresslist: createdFromData.billaddresslist
                }
                bodyFields = {...defaultBodyFields, ...bodyFields};
                return {
                    bodyFields,
                    lineItems: items
                }

            },

            /**
             * @description get the created from data
             * @param rmaRecord
             * @return {}
             */
            getCreatedFromData: async (recordId) => {
                let q = `
                   select 
                      T.id transactionId, 
                      T.recordtype, 
                      T.shippingaddress, 
                      T.billingaddress, 
                      TS.shippingmethod, 
                      SI.id shippingmethodid, 
                      TSAB.internalid shipaddresslist, 
                      TBAB.internalid billaddresslist 
                    from 
                      transaction T 
                      join transactionline TL on TL.transaction = T.id 
                      join transactionshipment TS on TS.doc = T.id 
                      join shipitem SI on SI.itemid = TS.shippingmethod 
                      join transactionShippingAddressbook TSAB on TSAB.addressBookAddress = T.shippingaddress 
                      join transactionBillingAddressbook TBAB on TBAB.addressBookAddress = T.billingaddress 
                    where 
                      T.id = ${recordId} 
                      and tl.mainline = 'T'
                        `;

                let queryResponse = await query.runSuiteQL.promise({query: q});
                let queryResults = queryResponse.asMappedResults();
                let createdFromData = queryResults.length > 0 ? queryResults[0] : {};
                return createdFromData;
            },


            doAsyncOperation: (process) => {
                return new Promise(function (resolve, reject) {
                    process(resolve, reject).then((resp) => {
                        console.log('doAsyncOperation:resp', resp);
                    });
                });
            }
        }

        return {
            HELPERS
        }


    });
