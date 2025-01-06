import { createResponse } from 'create-response';
import { httpRequest } from 'http-request';



// Akamai EdgeWorkers implementation to validate HMAC token
import { createHmac } from 'crypto';

//Forward valid HMAC request to origin
async function forwardRequest(request) {
  const url = `https://${request.host}${request.url}`;
  const opt = {
    "method": "POST",
    "body": request.body.pipeThrough(new TextEncoderStream()),
    "headers":request.getHeaders()
  }
  let response = await httpRequest(url, opt);
  return createResponse(response.status, getSafeResponseHeaders(response.headers), response.body);
}

async function generateHMAC(secretKey, message) {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secretKey);
  const messageData = encoder.encode(message);

  // Import the secret key for HMAC
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  // Generate the HMAC
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, messageData);

  // Convert ArrayBuffer to Base64
  return btoa(String.fromCharCode(...new Uint8Array(signature)));
}

function createMessageToSign(item) {
  const pspReference = item.pspReference || "";
  const originalReference = ""; // Not present in the provided JSON
  const merchantAccountCode = item.merchantAccountCode || "";
  const merchantReference = item.merchantReference || "";
  const amountValue = item.amount.value || "";
  const amountCurrency = item.amount.currency || "";
  const eventCode = item.eventCode || "";
  const success = item.success || "";

  return [
    pspReference,
    originalReference,
    merchantAccountCode,
    merchantReference,
    amountValue,
    amountCurrency,
    eventCode,
    success
  ].join(":");
}

export async function responseProvider(request) {
    try {
        // Step 1: Read the headers and body from the request
        //const headers = request.getHeaders();
        const body = await request.text(); // Retrieves the request body as text



        console.log('Request Headers:', JSON.stringify(headers));
        console.log('Request Body:', body);



        // Step 2: Parse the HMAC token from the body
        let requestBody;
        try {
            const bodyText = body.text;
            const jsonMatch = bodyText.match(/\{[\s\S]*\}/); // Regex to match the JSON object
                
            if (jsonMatch) {
                const jsonString = jsonMatch[0]; // Extract the JSON string
                requestBody = JSON.parse(jsonString); // Parse the JSON
            } else {
                return new Response('Invalid Request Format', { status: 400 });
            }

        } catch (error) {
            console.error('Invalid JSON format:', error);
            return new Response('Invalid request body format', { status: 400 });
        }

        const providedHmacToken =
            requestBody?.notificationItems?.[0]?.NotificationRequestItem?.additionalData?.hmacSignature;

        if (!providedHmacToken) {
            console.error('HMAC token is missing in the request body.');
            return new Response('HMAC token missing', { status: 400 });
        }

        console.log('Extracted HMAC Token:', hmacToken);

        const secretKey = 'C10F05E72121FF24810D3E72984FB07615B48BDF1C66DD6E5B11BACEB47C38E'; // Replace with your actual secret key
        // Now Compute the HMAC Token based on the sent message.

        //First contruct  the message
        const item = jsonBody.notificationItems[0]?.NotificationRequestItem;

         // Generate the message to be signed
         const message = createMessageToSign(item);

        // Generate HMAC using the secret key
        const generatedHmac = generateHMAC(secretKey, message);


        // Usage
        if (generatedHmac === providedHmacToken) {
          console.log("The HMAC token is valid.");
          return forwardRequest(body, request);
        } else {
          console.log("The HMAC token is invalid.");
          return new Response('Invalid HMAC token', { status: 403 });
        }

    } catch (error) {
        console.error('Error processing the request:', error);
        return new Response('Internal Server Error', { status: 500 });
    }
}
