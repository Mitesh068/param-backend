
const {shiprocketRequest} = require("../config/shiprocket");

const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

const required = (body, fields) =>
  fields.filter((field) => {
    const value = body[field];
    return value === undefined || value === null ||
      String(value).trim() === "";
  });

const createShiprocketOrder = asyncHandler(async (req, res) => {
  const {
    order_id,
    customer_name,
    customer_last_name = "",
    email,
    phone,
    address,
    address2 = "",
    city,
    state,
    pincode,
    items,
    payment_method = "Prepaid",
    sub_total,
    shipping_charges = 0,
    courier_id,
  } = req.body;

  const missing = required(req.body, [
    "order_id", "customer_name", "email", "phone",
    "address", "city", "state", "pincode", "sub_total",
  ]);

  if (missing.length) {
    return res.status(400).json({
      success: false,
      message: "Missing required fields",
      fields: missing,
    });
  }

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({
      success: false,
      message: "At least one order item is required",
    });
  }

  const invalidItem = items.some((item) =>
    !item.name ||
    !Number.isFinite(Number(item.price)) ||
    Number(item.price) <= 0 ||
    !Number.isInteger(Number(item.quantity)) ||
    Number(item.quantity) <= 0
  );

  if (invalidItem) {
    return res.status(400).json({
      success: false,
      message: "Each item needs a name, positive price and quantity",
    });
  }

  const total = Number(sub_total);
  const shipping = Number(shipping_charges);

  if (!Number.isFinite(total) || total < 0 ||
      !Number.isFinite(shipping) || shipping < 0) {
    return res.status(400).json({
      success: false,
      message: "Invalid subtotal or shipping charges",
    });
  }

  const pickupLocation = process.env.SHIPROCKET_PICKUP_LOCATION;

  if (!pickupLocation) {
    return res.status(500).json({
      success: false,
      message: "Shiprocket pickup location is not configured",
    });
  }

  // Use the existing order's items and totals from your database.
  // Never trust client-submitted prices for a real paid order.
  const orderItems = items.map((item) => ({
    name: item.name,
    sku: String(item.sku || item.product_id || item.name),
    units: Number(item.quantity),
    selling_price: Number(item.price).toFixed(2),
    discount: 0,
  }));

  const payload = {
    order_id: String(order_id),
    order_date: new Date().toISOString().slice(0, 10),
    pickup_location: pickupLocation,

    billing_customer_name: customer_name,
    billing_last_name: customer_last_name,
    billing_address: address,
    billing_address_2: address2,
    billing_city: city,
    billing_state: state,
    billing_pincode: String(pincode),
    billing_country: "India",
    billing_email: email,
    billing_phone: String(phone),

    shipping_is_billing: true,
    order_items: orderItems,

    payment_method,
    shipping_charges: shipping.toFixed(2),
    sub_total: total.toFixed(2),

    length: Number(process.env.SHIPROCKET_DEFAULT_LENGTH || 20),
    breadth: Number(process.env.SHIPROCKET_DEFAULT_BREADTH || 15),
    height: Number(process.env.SHIPROCKET_DEFAULT_HEIGHT || 10),
    weight: Number(process.env.SHIPROCKET_DEFAULT_WEIGHT || 0.5),
  };

  const data = await shiprocketRequest(
    "POST",
    "/orders/create/adhoc",
    payload
  );

  return res.status(201).json({
    success: true,
    message: "Shiprocket order created",
    data,
  });
});

const checkServiceability = asyncHandler(async (req, res) => {
  const { pickup_postcode, delivery_postcode, weight, cod = 0 } = req.query;

  if (!pickup_postcode || !delivery_postcode) {
    return res.status(400).json({
      success: false,
      message: "Pickup and delivery postcodes are required",
    });
  }

  const parcelWeight = Number(
    weight || process.env.SHIPROCKET_DEFAULT_WEIGHT || 0.5
  );

  if (!Number.isFinite(parcelWeight) || parcelWeight <= 0 ||
      ![0, 1].includes(Number(cod))) {
    return res.status(400).json({
      success: false,
      message: "Invalid weight or COD value",
    });
  }

  const data = await shiprocketRequest(
    "GET",
    "/courier/serviceability/",
    undefined,
    {
      pickup_postcode,
      delivery_postcode,
      weight: parcelWeight,
      cod: Number(cod),
    }
  );

  res.json({
    success: true,
    message: "Shipping serviceability retrieved",
    data,
  });
});

const assignAWB = asyncHandler(async (req, res) => {
  const { shipment_id, courier_id } = req.body;

  if (!shipment_id) {
    return res.status(400).json({
      success: false,
      message: "shipment_id is required",
    });
  }

  const payload = { shipment_id: Number(shipment_id) };

  if (courier_id) payload.courier_id = Number(courier_id);

  const data = await shiprocketRequest(
    "POST",
    "/courier/assign/awb",
    payload
  );

  res.json({
    success: true,
    message: "AWB assignment requested",
    data,
  });
});

const requestPickup = asyncHandler(async (req, res) => {
  const { shipment_id } = req.body;

  if (!shipment_id) {
    return res.status(400).json({
      success: false,
      message: "shipment_id is required",
    });
  }

  const data = await shiprocketRequest(
    "POST",
    "/courier/generate/pickup",
    { shipment_id: Number(shipment_id) }
  );

  res.json({
    success: true,
    message: "Pickup request submitted",
    data,
  });
});

const trackShipment = asyncHandler(async (req, res) => {
  const { awb } = req.params;

  if (!awb || !/^[a-zA-Z0-9-]+$/.test(awb)) {
    return res.status(400).json({
      success: false,
      message: "A valid AWB number is required",
    });
  }

  const data = await shiprocketRequest(
    "GET",
    `/courier/track/awb/${encodeURIComponent(awb)}`
  );

  res.json({
    success: true,
    message: "Shipment tracking retrieved",
    data,
  });
});

module.exports = {
  createShiprocketOrder,
  checkServiceability,
  assignAWB,
  requestPickup,
  trackShipment,
};
