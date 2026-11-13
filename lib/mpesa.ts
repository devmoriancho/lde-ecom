import "server-only";

type MpesaTokenResponse = {
  access_token?: string;
  errorMessage?: string;
};

export async function getMpesaAccessToken(): Promise<string> {
  const consumerKey = process.env.MPESA_CONSUMER_KEY;
  const consumerSecret = process.env.MPESA_CONSUMER_SECRET;

  if (!consumerKey || !consumerSecret) {
    throw new Error("M-PESA API credentials are missing.");
  }

  const credentials = Buffer.from(`${consumerKey}:${consumerSecret}`).toString(
    "base64",
  );

  const response = await fetch(
    "https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials",
    {
      method: "GET",
      headers: {
        Authorization: `Basic ${credentials}`,
      },
      cache: "no-store",
    },
  );

  if (!response.ok) {
    throw new Error(
      `M-PESA authentication failed with status ${response.status}.`,
    );
  }

  const data = (await response.json()) as MpesaTokenResponse;

  if (!data.access_token) {
    throw new Error("M-PESA did not return an access token.");
  }

  return data.access_token;
}

function generateMpesaPassword() {
  const shortcode = process.env.MPESA_SHORTCODE;
  const passkey = process.env.MPESA_PASSKEY;

  if (!shortcode || !passkey) {
    throw new Error("M-PESA shortcode or passkey is missing.");
  }

  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Nairobi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());

  const getPart = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? "";

  const timestamp =
    getPart("year") +
    getPart("month") +
    getPart("day") +
    getPart("hour") +
    getPart("minute") +
    getPart("second");

  const password = Buffer.from(`${shortcode}${passkey}${timestamp}`).toString(
    "base64",
  );

  return { timestamp, password };
}

type MpesaStkPushResponse = {
  MerchantRequestID?: string;
  CheckoutRequestID?: string;
  ResponseCode?: string;
  ResponseDescription?: string;
  CustomerMessage?: string;
};

type StkPushInput = {
  phoneNumber: string;
  amount: number;
  accountReference: string;
  transactionDesc: string;
  callbackUrl: string;
};

export async function initiateMpesaStkPush(
  input: StkPushInput,
): Promise<MpesaStkPushResponse> {
  const shortcode = process.env.MPESA_SHORTCODE;

  if (!shortcode) {
    throw new Error("M-PESA shortcode is missing.");
  }

  if (!Number.isSafeInteger(input.amount) || input.amount < 1) {
    throw new Error("M-PESA amount must be a positive whole number.");
  }

  if (!/^2547\d{8}$/.test(input.phoneNumber)) {
    throw new Error("Phone number must use the format 2547XXXXXXXX.");
  }

  const callbackUrl = new URL(input.callbackUrl);

  if (callbackUrl.protocol !== "https:") {
    throw new Error("M-PESA callback URL must use HTTPS.");
  }

  const accessToken = await getMpesaAccessToken();
  const { timestamp, password } = generateMpesaPassword();

  const response = await fetch(
    "https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        BusinessShortCode: shortcode,
        Password: password,
        Timestamp: timestamp,
        TransactionType: "CustomerPayBillOnline",
        Amount: input.amount,
        PartyA: input.phoneNumber,
        PartyB: shortcode,
        PhoneNumber: input.phoneNumber,
        CallBackURL: callbackUrl.toString(),
        AccountReference: input.accountReference,
        TransactionDesc: input.transactionDesc,
      }),
      cache: "no-store",
    },
  );

  const data = (await response.json()) as MpesaStkPushResponse;

  if (!response.ok || data.ResponseCode !== "0") {
    throw new Error(
      data.ResponseDescription ??
        `M-PESA STK Push failed with status ${response.status}.`,
    );
  }

  return data;
}
