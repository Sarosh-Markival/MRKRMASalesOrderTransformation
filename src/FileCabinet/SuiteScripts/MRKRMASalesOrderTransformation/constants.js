/**
 * @NApiVersion 2.1
 */
define([],
    () => {
        const CONSTANTS = {
            DEFAULTS: {
                SALES_ORDER: {
                    BODY: {
                        terms: '18', //Replacement,
                        orderstatus: 'B', //Pending Fulfillment
                        shippingcost: 0,
                    }
                }
            },
            SCRIPTS: {
                USEREVENT: {
                    SCRIPT_ID: 'customscript_mrk_rma_sales_order_transformation',
                    DEPLOYMENT_ID: 'customdeploy_mrk_rma_sales_order_transformation',
                    PARAMS: {}
                },
                CLIENT: {
                    SCRIPT_ID: '',
                    DEPLOYMENT_ID: '',
                    PARAMS: {}
                },
                SUITELET: {
                    SCRIPT_ID: 'customscript_mrk_return_so_transform_sl',
                    DEPLOYMENT_ID: 'customdeploy_mrk_return_so_transform_sl',
                    PARAMS: {},
                    ACTIONS: {
                        CREATE_SALES_ORDER: 'createSalesOrder'
                    }
                }
            },
            RMA: {
                BUTTON: {
                    ID: 'custpage_mrk_create_so_button',
                    LABEL: 'Create Replacement Order',
                    FUNCTION: 'createSalesOrder'
                }
            },
            FIELDS: {
                TRANSACTION: {
                    BODY: {
                        RETURN_TRANSACTION: 'custbody_mrk_return_transaction'
                    }
                }
            },
            MESSAGES: {
                CONFIRMATION: {
                    TITLE: 'Sales Order Creation',
                    MESSAGE: 'Do you want to create a Sales Order from this RMA? Sales Order will be created only if all the items are in stock.'
                },
                CHECK_ITEMS_IN_STOCK: {
                    TITLE: 'Checking if all items are in stock...',
                    MESSAGE: '<b>Do not exit the page until the process is completed.</b>'

                },
                OOS: (items) => {
                    return {
                        TITLE: 'Cannot Create Sales Order',
                        MESSAGE: `The following items are not in stock:<br><br> ${items.map(itemObj => `<b>${itemObj.item}</b>`).join('<br>')}<br><br>Please create a credit memo for these items.`
                    }
                },
                SALES_ORDER_CREATION: {
                    TITLE: 'Creating Sales Order',
                    MESSAGE: '<b>Do not exit the page until the process is completed.</b>'
                },
                SALES_ORDER_CREATION_ERROR: (errM) => {
                    return {
                        TITLE: 'Sales Order Creation Error',
                        MESSAGE: `An error occurred while creating the Sales Order: ${errM}`
                    }
                },
                SALES_ORDER_EXISTS: {
                    TITLE: 'Sales Order Exists',
                    MESSAGE: '<b>A Sales Order already exists for this RMA.</b>'
                },
                SALES_ORDER_CREATED: (recordId) => {
                    return {
                        TITLE: 'Sales Order Created',
                        MESSAGE: `<b>Sales Order with record id ${recordId} has been created successfully.<br>You will be redirected to the Sales Order.</b>`
                    }
                },

            }
        }
        return {CONSTANTS}
    });
