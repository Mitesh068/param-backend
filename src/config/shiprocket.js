
const axios = require("axios");

const BASE_URL = "https://apiv2.shiprocket.in/v1/external";

let cachedToken = null;
let tokenExpiry = 0;

const shiprocketClient = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
  headers: {
    "Content-Type": "application/json",
  },
});

async function getShiprocketToken() {
  if (cachedToken && Date.now() < tokenExpiry) {
    return cachedToken;
  }

  const email = process.env.SHIPROCKET_EMAIL;
  const password = process.env.SHIPROCKET_PASSWORD;

  if (!email || !password) {
    throw new Error("Shiprocket API credentials are missing");
  }

  const { data } = await shiprocketClient.post("/auth/login", {
    email,
    password,
  });

  if (!data?.token) {
    throw new Error("Shiprocket authentication failed");
  }

  cachedToken = data.token;

  // Refresh before the documented 10-day token expiry.
  tokenExpiry = Date.now() + 9 * 24 * 60 * 60 * 1000;

  return cachedToken;
}

async function shiprocketRequest(method, url, data, params) {
  const token = await getShiprocketToken();

  const response = await shiprocketClient.request({
    method,
    url,
    data,
    params,
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return response.data;
}

module.exports = {
  shiprocketClient,
  getShiprocketToken,
  shiprocketRequest,
};
