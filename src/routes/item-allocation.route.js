const express = require("express");
const { getItemAllocation } = require("../services/item-allocation.service");

const router = express.Router();

function getBigcommerceAuthHeaders(req) {
  const storeHash = req.header("store_hash");
  const accessToken = req.header("token");

  return { storeHash, accessToken };
}

router.post("/getItemAllocation", async (req, res, next) => {
  try {
    const authHeaders = getBigcommerceAuthHeaders(req);
    const result = await getItemAllocation(req.body, authHeaders);
    if (result.isNewCustomer === true) {
      res.status(200).json({
        status: 200,
        message: "ok",
        data: [],
        isNewCustomer: true,
      });
      return;
    }
    res.status(200).json({
      status: 200,
      message: "ok",
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;