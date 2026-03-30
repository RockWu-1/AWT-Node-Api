const express = require("express");
const { getItemAllocation } = require("../services/item-allocation.service");

const router = express.Router();

router.post("/getItemAllocation", async (req, res, next) => {
  try {
    const result = await getItemAllocation(req.body);
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