const express = require("express");
const router = express.Router();

router.get("/", (req, res) => {
  res.send("Sunucu calisiyor");
});

module.exports = router;
