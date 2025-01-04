import { createResponse } from 'create-response';
import { httpRequest } from 'http-request';

// Function to verify HMAC
async function verifyHmac(secretKey, message, providedHmacToken) {
  // Convert secret and message to ArrayBuffer
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secretKey);
  const messageData = encoder.encode(message);

  // Import the key for HMAC
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: { name: "SHA-256" } },
    false,
    ["sign"]
  );

  // Compute the HMAC for the message
  const computedHmac = await crypto.subtle.sign("HMAC", cryptoKey, messageData);

  // Convert both HMACs to hex for comparison
  const computedHmacHex = Array.from(new Uint8Array(computedHmac))
    .map(byte => byte.toString(16).padStart(2, "0"))
    .join("");

  // Perform a secure comparison of the provided HMAC and computed HMAC
  return timingSafeCompare(providedHmacToken, computedHmacHex);
}

// Secure comparison to prevent timing attacks
function timingSafeCompare(a, b) {
  if (a.length !== b.length) {
    return false; // Length mismatch, cannot be equal
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i); // XOR comparison
  }
  return true;
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

        // Usage
        if (verifyHmac(secretKey, body, providedHmacToken)) {
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
