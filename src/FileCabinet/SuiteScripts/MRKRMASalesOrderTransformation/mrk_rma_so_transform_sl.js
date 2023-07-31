/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 */
define(['N/https', 'N/runtime', './serverModuleHelper'],
    /**
     * @param{https} https
     * @param{runtime} runtime
     */
    (https, runtime, helperMod) => {
        /**
         * Defines the Suitelet script trigger point.
         * @param {Object} scriptContext
         * @param {ServerRequest} scriptContext.request - Incoming request
         * @param {ServerResponse} scriptContext.response - Suitelet response
         * @since 2015.2
         */
        const onRequest = (scriptContext) => {
            let resp = {success: false, message: '', action: '', method: ''};
            const {request, response} = scriptContext;
            const {parameters} = request;
            const {method} = request;
            const {action = 'Unknown'} = parameters
            resp.action = action;
            resp.method = method;
            try {
                switch (method) {
                    case https.Method.GET:
                        break;
                    case https.Method.POST:
                        switch (action) {
                            case 'createSalesOrder':
                                resp = {resp, ...helperMod.HELPERS.createSalesOrder(request)};
                                break;
                            default:
                                break;
                        }
                        break;
                }


            } catch (e) {
                let err = `Error in onRequest: ${e.message} - ${e.stack}`;
                log.error('onRequest:e', err);
                resp.message = err;

            } finally {
                response.write(JSON.stringify(resp));
            }

        }

        return {onRequest}

    });
