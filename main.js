export function onClientRequest(request) {
    const requestBody = request.getVariable('REQ_BODY');
    if (requestBody) {
        console.log(`Request Body: ${requestBody}`);
    } else {
        console.log('Request Body is not available.');
    }
}