
const mongoose = require("mongoose");

const INDICATOR_SCHEMA = new mongoose.Schema({
  INDICATOR: String,
  VALUE: Number
}, { _id: false });

const CHART_DATA_SCHEMA = new mongoose.Schema({
  DATE: { type: Date, required: true },
  OPEN: Number,
  HIGH: Number,
  LOW: Number,
  CLOSE: Number,
  VOLUME: Number,
  INDICATORS: { type: [INDICATOR_SCHEMA], default: [] }
}, { _id: false });

const SIGNAL_SCHEMA = new mongoose.Schema({
  DATE: { type: Date, required: true },
  TYPE: { type: String },
  PRICE: { type: Number, required: true },
  REASONING: { type: String },
  SHARES: { type: Number, default: 0 }
}, { _id: false });

const SUMMARY_SCHEMA = new mongoose.Schema({
  TOTAL_BOUGHT_UNITS: Number,
  TOTAL_SOLDUNITS: Number,
  REMAINING_UNITS: Number,
  FINAL_CASH: Number,
  FINAL_VALUE: Number,
  FINAL_BALANCE: Number,
  REAL_PROFIT: Number,
  PERCENTAGE_RETURN: Number
}, { _id: false });

const DETAIL_ROW_REG_SCHEMA = new mongoose.Schema({
  CURRENT: Boolean,
  REGDATE: Date,
  REGTIME: String,
  REGUSER: String
}, { _id: false });

const DETAIL_ROW_SCHEMA = new mongoose.Schema({
  ACTIVED: Boolean,
  DELETED: Boolean,
  DETAIL_ROW_REG: { type: [DETAIL_ROW_REG_SCHEMA], default: [] }
}, { _id: false });

const SIMULATION_SCHEMA = new mongoose.Schema({
  SIMULATIONID: { type: String, required: true },
  USERID: { type: String, required: true },
  STRATEGYID: { type: String, required: true },
  SIMULATIONNAME: { type: String, required: true },
  SYMBOL: { type: String, required: true },
  STARTDATE: { type: Date, required: true },
  ENDDATE: { type: Date, required: true },
  AMOUNT: { type: Number, required: true },
  SIGNALS: { type: [SIGNAL_SCHEMA], default: [] },
  INDICATORS: { type: [INDICATOR_SCHEMA], default: [] },
  SUMMARY: SUMMARY_SCHEMA,
  CHART_DATA: { type: [CHART_DATA_SCHEMA], default: [] },
  DETAIL_ROW: DETAIL_ROW_SCHEMA
});


module.exports = mongoose.model("BD", SIMULATION_SCHEMA, "BD");
