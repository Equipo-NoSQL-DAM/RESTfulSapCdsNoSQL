const mongoose = require("mongoose");
const axios = require("axios");
const API_KEY = "demo";
const APIKEY = "demo";

async function crudSimulation(req) {
  try {
    const action = req.req.query.action;

    if (!action) {
      throw new Error("El parámetro 'action' es obligatorio.");
    }

    switch (action) {
      case "get":
        try {
          let result;
          const simulationId = req?.req?.query?.SIMULATIONID;
          const simulation = req?.req?.query?.SIMULATIONNAME;
          const strategieid = req?.req?.query?.STRATEGYID;
          const symbol = req?.req?.query?.SYMBOL;
          //
          const REAL_PROFIT = Number(req.req.query.REAL_PROFIT); // el valor que pasa el usuario

          const baseFilter = { "DETAIL_ROW.ACTIVED": true };

          if (simulationId) {
            result = await mongoose.connection

              .collection("SIMULATION")
              .find({ ...baseFilter, SIMULATIONID: simulationId })
              .toArray();
            console.log("1");
          } else if (simulation) {
            result = await mongoose.connection
              .collection("SIMULATION")
              .find({
                ...baseFilter,
                simulationName: { $regex: simulation, $options: "i" },
              })
              .toArray();
          } else if (strategieid) {
            result = await mongoose.connection
              .collection("SIMULATION")
              .find({ ...baseFilter, idStrategy: strategieid })
              .toArray();
          } else if (REAL_PROFIT) {
            result = await mongoose.connection
              .collection("SIMULATION")
              .find({
                ...baseFilter,
                "SUMMARY.REAL_PROFIT": { $gt: Number(REAL_PROFIT) },
              })
              .toArray();
          } else if (symbol) {
            result = await mongoose.connection
              .collection("SIMULATION")
              .find({ ...baseFilter, symbol: symbol })
              .toArray();
          } else if (simulationId) {
            const queryStartDateParam = req?.req?.query?.startDate;
            const queryEndDateParam = req?.req?.query?.endDate;
            const pipeline = [
              {
                $match: {
                  ...baseFilter,
                  idSimulation: simulationId,
                },
              },
              {
                $project: {
                  idSimulation: 1,
                  idUser: 1,
                  idStrategy: 1,
                  simulationName: 1,
                  symbol: 1,
                  startDate: 1,
                  endDate: 1,
                  amount: 1,
                  specs: 1,
                  result: 1,
                  percentageReturn: 1,
                  summary: 1,
                  DETAIL_ROW: 1,
                  signals: {
                    $filter: {
                      input: "$signals",
                      as: "signal",
                      cond: {
                        $and: [
                          {
                            $gte: [
                              { $toDate: "$$signal.date" },
                              queryStartDateParam,
                            ],
                          },
                          {
                            $lte: [
                              { $toDate: "$$signal.date" },
                              queryEndDateParam,
                            ],
                          },
                        ],
                      },
                    },
                  },
                },
              },
            ];

            result = await mongoose.connection
              .collection("SIMULATION")
              .aggregate(pipeline)
              .toArray();
          } else {
            result = await mongoose.connection
              .collection("SIMULATION")
              .find(baseFilter)
              .toArray();
            console.log("4");
          }

          return result;
        } catch (error) {
          console.error("Error al obtener simulaciones:", error);
          throw new Error("Error al obtener simulaciones");
        }

      case "delete":
        try {
          const { id, borrado } = req?.req?.query || {};
          const idUser = "USER_TEST";

          // Validación
          if (!id) {
            throw new Error(
              "Se debe proporcionar el ID de la simulación a eliminar"
            );
          }

          const filter = { idSimulation: id };
          const collection = mongoose.connection.collection("SIMULATION");

          // Comprobar existencia
          const existing = await collection.findOne(filter);
          if (!existing) {
            throw new Error(`No existe simulación con idSimulation=${id}`);
          }

          // Comprobar estado previo
          const dr = existing.DETAIL_ROW;
          if (dr?.DELETED === true && dr?.ACTIVED === false) {
            throw new Error(
              "La simulación ya fue eliminada lógicamente anteriormente"
            );
          }

          // Registro de auditoría
          const regEntry = {
            CURRENT: true,
            REGDATE: new Date(),
            REGTIME: new Date(),
            REGUSER: idUser,
          };

          if (borrado === "fisic") {
            // Borrado físico: eliminamos todo el documento
            const delRes = await collection.deleteOne(filter);
            if (delRes.deletedCount === 0) {
              throw new Error("No se pudo eliminar físicamente la simulación");
            }
            return { message: "Simulación eliminada físicamente" };
          } else {
            // Borrado lógico: seteamos flags y push al historial
            await collection.updateOne(filter, {
              $set: { "DETAIL_ROW.0.DETAIL_ROW_REG.$[].CURRENT": false },
            });

            const updRes = await collection.updateOne(filter, {
              $set: {
                "DETAIL_ROW.0.ACTIVED": false,
                "DETAIL_ROW.0.DELETED": true,
              },
              $push: {
                "DETAIL_ROW.0.DETAIL_ROW_REG": regEntry,
              },
            });

            if (updRes.modifiedCount === 0) {
              throw new Error("No se pudo marcar como eliminada la simulación");
            }
            return { message: "Simulación marcada como eliminada lógicamente" };
          }
        } catch (error) {
          console.error(
            "Error al eliminar simulación:",
            error.message || error
          );
          throw {
            code: 400,
            message: error.message || "Error al eliminar simulación",
            "@Common.numericSeverity": 4,
          };
        }
      //crudSimualtion?action=post
      case "post":
        try {
          const {
            symbol,
            initial_investment,
            simulationName,
            startDate,
            endDate,
            rsiPeriod: rsiPeriodFromQuery, // Renombrar para evitar conflicto con la variable local
          } = req?.req?.query || {};

          if (
            !symbol ||
            !initial_investment ||
            !simulationName ||
            !startDate ||
            !endDate
          ) {
            throw new Error(
              "Faltan parámetros requeridos: 'symbol', 'initial_investment', 'simulationName', 'startDate', 'endDate'."
            );
          }

          const idUser = "USER_TEST";
          const idStrategy = "STRATEGY_001";

          switch (simulationName) {
            case "ReversionSimple":
              const apiKey = "demo"; // Reemplaza con tu API key
              const apiUrl = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${symbol}&outputsize=full&apikey=${apiKey}`;
              const response = await axios.get(apiUrl);
              const optionsData = response.data["Time Series (Daily)"];

              if (!optionsData || Object.keys(optionsData).length === 0) {
                throw new Error(
                  "No se encontraron datos de precios históricos."
                );
              }

              const smaPeriod = 5;
              // Establecer dinámicamente rsiPeriod, por defecto a 14 si no se proporciona o es inválido
              const rsiPeriod = parseInt(rsiPeriodFromQuery) || 14;
              const bufferDays = Math.max(smaPeriod, rsiPeriod);

              const allDatesSorted = Object.keys(optionsData).sort(
                (a, b) => new Date(a) - new Date(b)
              );

              const extendedStartIndex =
                allDatesSorted.findIndex((date) => date >= startDate) -
                bufferDays;

              const adjustedStartIndex =
                extendedStartIndex >= 0 ? extendedStartIndex : 0;

              const filteredPrices = allDatesSorted
                .slice(adjustedStartIndex)
                .filter((date) => date <= endDate)
                .map((date) => ({
                  date,
                  open: parseFloat(optionsData[date]["1. open"]),
                  high: parseFloat(optionsData[date]["2. high"]),
                  low: parseFloat(optionsData[date]["3. low"]),
                  close: parseFloat(optionsData[date]["4. close"]),
                  volume: parseFloat(optionsData[date]["5. volume"]),
                }));

              if (filteredPrices.length < bufferDays) {
                throw new Error(
                  "No hay suficientes datos para calcular la estrategia."
                );
              }

              const smaValues = filteredPrices.map((_, i, arr) => {
                if (i < smaPeriod - 1) return null;
                const sum = arr
                  .slice(i - smaPeriod + 1, i + 1)
                  .reduce((acc, val) => acc + val.close, 0);
                return sum / smaPeriod;
              });

              const rsiValues = [];
              for (let i = 0; i < filteredPrices.length; i++) {
                if (i < rsiPeriod) {
                  rsiValues.push(null);
                  continue;
                }

                let gains = 0,
                  losses = 0;
                for (let j = i - rsiPeriod + 1; j <= i; j++) {
                  const change =
                    filteredPrices[j].close - filteredPrices[j - 1].close;
                  if (change > 0) gains += change;
                  else losses -= change;
                }

                const avgGain = gains / rsiPeriod;
                const avgLoss = losses / rsiPeriod;
                const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
                const rsi = 100 - 100 / (1 + rs);
                rsiValues.push(parseFloat(rsi.toFixed(2)));
              }

              const signals = [];
              let unitsHeld = 0;
              let cash = parseFloat(initial_investment);
              let totalBoughtUnits = 0;
              let totalSoldUnits = 0;
              const boughtPrices = [];
              let totalRealProfit = 0; // Ganancia real acumulada
              // Inicializamos el subdocumento para la última operación como un objeto vacío
              let lastOperation = {};

              const pricesHistory = [];
              const chartData = []; // Inicializamos el array para chart_data

              for (let i = 0; i < filteredPrices.length; i++) {
                const {
                  date,
                  open,
                  high,
                  low,
                  close: price,
                  volume,
                } = filteredPrices[i];
                if (date < startDate) continue;

                const sma = smaValues[i];
                const rsi = rsiValues[i];

                const dailySignal = {
                  date,
                  price,
                  sma: sma !== null ? parseFloat(sma.toFixed(2)) : null,
                  rsi: rsi !== null ? parseFloat(rsi.toFixed(2)) : null,
                  calculation: "",
                  signal: null,
                  reasoning: null,
                  holding: unitsHeld > 0,
                  unitsBought: 0,
                  unitsSold: 0,
                  cashBefore: parseFloat(cash.toFixed(2)),
                  cashAfter: null,
                  unitsHeldAfter: null,
                  spent: 0,
                  earned: 0,
                  purchasePrice: null,
                  sellingPrice: null,
                  realProfit: 0, // Ganancia real del día
                };

                if (price < sma * 0.98 && cash > 0) {
                  const investment = cash * 0.5;
                  const unitsToBuy = investment / price;
                  const spent = unitsToBuy * price;
                  unitsHeld += unitsToBuy;
                  cash -= spent;
                  totalBoughtUnits += unitsToBuy;
                  boughtPrices.push({ date, price, units: unitsToBuy });

                  dailySignal.signal = "COMPRA";
                  dailySignal.reasoning = `El precio está por debajo del 98% del SMA. RSI: ${rsi.toFixed(
                    2
                  )}`;
                  dailySignal.calculation = `${price.toFixed(2)} < ${(
                    sma * 0.98
                  ).toFixed(2)}`;
                  dailySignal.unitsBought = parseFloat(unitsToBuy.toFixed(4));
                  dailySignal.spent = parseFloat(spent.toFixed(2));
                  dailySignal.purchasePrice = parseFloat(price.toFixed(2));

                  // Actualizar lastOperation
                  lastOperation = {
                    type: "COMPRA",
                    price: parseFloat(price.toFixed(2)),
                    reasoning: dailySignal.reasoning,
                  };
                } else if (price > sma * 1.02 && unitsHeld > 0) {
                  const unitsToSell = unitsHeld * 0.25;
                  const revenue = unitsToSell * price;
                  cash += revenue;
                  unitsHeld -= unitsToSell;
                  totalSoldUnits += unitsToSell;

                  let soldUnitsCounter = unitsToSell;
                  let purchasePricesForSale = [];
                  for (
                    let j = 0;
                    j < boughtPrices.length && soldUnitsCounter > 0;
                    j++
                  ) {
                    const purchase = boughtPrices[j];
                    if (purchase.units <= soldUnitsCounter) {
                      purchasePricesForSale.push(purchase.price);
                      soldUnitsCounter -= purchase.units;
                      boughtPrices.splice(j, 1);
                      j--;
                    } else {
                      purchasePricesForSale.push(purchase.price);
                      boughtPrices[j].units -= soldUnitsCounter;
                      soldUnitsCounter = 0;
                    }
                  }
                  const averagePurchasePrice =
                    purchasePricesForSale.reduce(
                      (sum, price) => sum + price,
                      0
                    ) / purchasePricesForSale.length;
                  const realProfit =
                    (price - averagePurchasePrice) * unitsToSell; // Calcular ganancia real
                  totalRealProfit += realProfit; // Acumular ganancia real

                  dailySignal.signal = "VENTA";
                  dailySignal.reasoning = `El precio está por encima del 102% del SMA. RSI: ${rsi.toFixed(
                    2
                  )}`;
                  dailySignal.calculation = `${price.toFixed(2)} > ${(
                    sma * 1.02
                  ).toFixed(2)}`;
                  dailySignal.unitsSold = parseFloat(unitsToSell.toFixed(4));
                  dailySignal.earned = parseFloat(revenue.toFixed(2));
                  dailySignal.purchasePrice = parseFloat(
                    averagePurchasePrice.toFixed(2)
                  );
                  dailySignal.sellingPrice = parseFloat(price.toFixed(2));
                  dailySignal.realProfit = parseFloat(realProfit.toFixed(2)); // Agregar ganancia real al objeto

                  // Actualizar lastOperation
                  lastOperation = {
                    type: "VENTA",
                    price: parseFloat(price.toFixed(2)),
                    reasoning: dailySignal.reasoning,
                  };
                }

                dailySignal.cashAfter = parseFloat(cash.toFixed(2));
                dailySignal.unitsHeldAfter = parseFloat(unitsHeld.toFixed(4));
                signals.push(dailySignal);

                pricesHistory.push({
                  Date: date,
                  Open: open,
                  High: high,
                  Low: low,
                  Close: price,
                  Volume: volume,
                  Indicators:
                    sma !== null && rsi !== null
                      ? `SMA: ${sma.toFixed(2)}, RSI: ${rsi.toFixed(2)}`
                      : "",
                  Signal: dailySignal.signal || "",
                  Rules: dailySignal.reasoning || "",
                  Shares: parseFloat(unitsHeld.toFixed(4)),
                });

                // Agregamos los datos para chart_data, incluyendo el valor del SMA
                chartData.push({
                  Date: date,
                  Open: open,
                  High: high,
                  Low: low,
                  Close: price,
                  Volume: volume,
                  Shares: parseFloat(unitsHeld.toFixed(4)),
                  SMA: sma !== null ? parseFloat(sma.toFixed(2)) : null, // Aquí agregamos el SMA
                });
              }

              const lastPrice = filteredPrices.at(-1).close;
              const finalValue = unitsHeld * lastPrice;
              const finalBalance = cash + finalValue;

              const simulation = {
                idSimulation: `SIM_${Date.now()}`,
                idUser,
                idStrategy,
                simulationName,
                symbol,
                startDate,
                endDate,
                amount: parseFloat(initial_investment),
                specs: `Tendencia: bajista, Volatilidad: alta, Periodo RSI: ${rsiPeriod}`,
                result: parseFloat(
                  (finalBalance - initial_investment).toFixed(2)
                ),
                percentageReturn: parseFloat(
                  (
                    ((finalBalance - initial_investment) / initial_investment) *
                    100
                  ).toFixed(2)
                ),
                summary: {
                  totalBoughtUnits: parseFloat(totalBoughtUnits.toFixed(4)),
                  totalSoldUnits: parseFloat(totalSoldUnits.toFixed(4)),
                  remainingUnits: parseFloat(unitsHeld.toFixed(4)),
                  finalCash: parseFloat(cash.toFixed(2)),
                  finalValue: parseFloat(finalValue.toFixed(2)),
                  finalBalance: parseFloat(finalBalance.toFixed(2)),
                  realProfit: parseFloat(totalRealProfit.toFixed(2)), // Agregar ganancia real al resumen
                },
                signals,
                historicalPrices: pricesHistory,
                chart_data: chartData, // Agregamos el subarreglo chart_data aquí
                lastOperation: lastOperation, // Agregamos el subdocumento de la última operación
                DETAIL_ROW: [
                  {
                    ACTIVED: true,
                    DELETED: false,
                    DETAIL_ROW_REG: [
                      {
                        CURRENT: true,
                        REGDATE: new Date(),
                        REGTIME: new Date(),
                        REGUSER: "FIBARRAC",
                      },
                    ],
                  },
                ],
              };

              await mongoose.connection
                .collection("SIMULATION")
                .insertOne(simulation);

              await mongoose.connection.collection("ZTPRICESHISTORY").updateOne(
                { symbol },
                {
                  $set: { symbol, lastUpdated: new Date() },
                  $addToSet: {
                    prices: {
                      $each: filteredPrices.map(({ date, close }) => ({
                        date,
                        close,
                      })),
                    },
                  },
                },
                { upsert: true }
              );

              return {
                message: "Simulación creada exitosamente.",
                simulation,
              };

            default:
              throw new Error("Estrategia no reconocida.");
          }
        } catch (error) {
          return {
            error: true,
            message: error.message || "Error al procesar la solicitud.",
          };
        }

      case "update":
        try {
          const { id } = req?.req?.query || {};
          const simulation = req?.data?.simulation;
          const idUser = "USER_TEST";
          if (!id) {
            throw new Error(
              "Se debe proporcionar el ID de la simulación a actualizar en query (param 'id')."
            );
          }

          if (!simulation?.simulationName) {
            throw new Error(
              "Se debe proporcionar un nuevo nombre para la simulación en 'simulation.simulationName'."
            );
          }

          const collection = mongoose.connection.collection("SIMULATION");
          const existing = await collection.findOne({ idSimulation: id });
          if (!existing) {
            return {
              "@odata.context": "$metadata#entsimulation",
              message: `No existe simulación con ID ${id}`,
            };
          }

          const regEntry = {
            CURRENT: true,
            REGDATE: new Date(),
            REGTIME: new Date(),
            REGUSER: idUser,
          };

          await collection.updateOne(
            { idSimulation: id },
            {
              $set: {
                "DETAIL_ROW.0.DETAIL_ROW_REG.$[].CURRENT": false,
              },
            }
          );

          // 2. Setear nuevo nombre y agregar nueva entrada de auditoría
          const updRes = await collection.updateOne(
            { idSimulation: id },
            {
              $set: {
                simulationName: simulation.simulationName,
              },
              $push: {
                "DETAIL_ROW.0.DETAIL_ROW_REG": regEntry,
              },
            }
          );

          if (updRes.modifiedCount === 0) {
            throw new Error("No se pudo actualizar la simulación");
          }

          const updatedDoc = await collection.findOne({ idSimulation: id });
          return {
            "@odata.context": "$metadata#entsimulation",
            message: "Nombre de simulación actualizado exitosamente.",
            simulation: updatedDoc,
          };
        } catch (err) {
          console.error("Error al actualizar simulación:", err.message || err);
          throw new Error(
            `Error en UPDATE de simulación: ${err.message || err}`
          );
        }

      default:
        throw new Error(`Acción no soportada: ${action}`);
    }
  } catch (error) {
    console.error("Error en crudSimulation:", error.message);
    throw error;
  }
}

const connectToMongoDB = require("../../lib/mongo");

async function crudStrategies(req) {
  try {
    const action = req.req.query.action;
    if (!action) throw new Error("El parámetro 'action' es obligatorio.");

    await connectToMongoDB(); // conecta a Mongo
    //get start

    switch (action) {
      case "post":
        try {
          const strategyData = req.data?.strategy;
          const strategyID = strategyData?.ID;

          if (!strategyID) {
            return req.error(400, "Se requiere un ID.");
          }

          const existing = await Strategy.findOne({ ID: strategyID });
          if (existing) {
            return req.error(
              409,
              `Ya existe una estrategia con ID '${strategyID}'.`
            );
          }

          const newStrategy = new Strategy({
            ...strategyData,
            DETAIL_ROW: {
              ACTIVED: true,
              DELETED: false,
              DETAIL_ROW_REG: [
                {
                  CURRENT: true,
                  REGDATE: new Date(),
                  REGTIME: new Date(),
                  REGUSER: "FIBARRAC",
                },
              ],
            },
          });

          await newStrategy.save();

          return {
            message: "Estrategia creada correctamente.",
            strategy: newStrategy.toObject(),
          };
        } catch (error) {
          console.error("Error en postStrategy:", error.message);
          return req.error(500, `Error al crear estrategia: ${error.message}`);
        }
      case "update":
        try {
          const { id } = req?.req?.query || {};
          const strategyData = req.data?.strategy;

          if (!id) {
            return req.error(
              400,
              "Se debe proporcionar el ID de la estrategia en query (param 'id')."
            );
          }
          if (!strategyData) {
            return req.error(
              400,
              "Se debe proporcionar en el body un objeto 'strategy'."
            );
          }

          const updates = { ...strategyData };
          delete updates.ID;

          if (Object.keys(updates).length === 0) {
            return req.error(
              400,
              "Debe especificar al menos un campo distinto de 'ID' para actualizar."
            );
          }

          const existing = await Strategy.findOne({ ID: id });
          if (!existing) {
            return req.error(404, `No se encontró estrategia con ID '${id}'.`);
          }

          Object.assign(existing, updates);

          existing.DETAIL_ROW = existing.DETAIL_ROW || {
            ACTIVED: true,
            DELETED: false,
            DETAIL_ROW_REG: [],
          };
          existing.DETAIL_ROW.DETAIL_ROW_REG.push({
            CURRENT: true,
            REGDATE: new Date(),
            REGTIME: new Date(),
            REGUSER: "FIBARRAC",
          });

          await existing.save();
          return {
            message: "Estrategia actualizada correctamente.",
            strategy: existing.toObject(),
          };
        } catch (error) {
          console.error("Error en patchStrategy:", error.message);
          return req.error(
            500,
            `Error al actualizar estrategia: ${error.message}`
          );
        }

      case "delete":
        try {
          const { id, borrado } = req?.req?.query || {};
          const idUser = "USER_TEST";

          // 1) Validación
          if (!id) {
            return req.error(
              400,
              "Se debe proporcionar el ID de la estrategia en query (param 'id')."
            );
          }

          const collection = mongoose.connection.collection("STRATEGIES");
          const filter = { ID: id };

          // 2) Buscar documento
          let existing = await collection.findOne(filter);
          if (!existing) {
            return req.error(404, `No se encontró estrategia con ID '${id}'.`);
          }

          // 3) Inicializar DETAIL_ROW si no existe
          if (!existing.DETAIL_ROW) {
            await collection.updateOne(filter, {
              $set: {
                DETAIL_ROW: {
                  ACTIVED: true,
                  DELETED: false,
                  DETAIL_ROW_REG: [],
                },
              },
            });
            existing = await collection.findOne(filter);
          }

          const regEntry = {
            CURRENT: true,
            REGDATE: new Date(),
            REGTIME: new Date(),
            REGUSER: idUser,
          };

          if (borrado === "fisic") {
            const delRes = await collection.deleteOne(filter);
            if (delRes.deletedCount === 0) {
              throw new Error("No se pudo eliminar físicamente la estrategia");
            }
            return {
              message: `Estrategia con ID '${id}' eliminada físicamente.`,
            };
          } else {
            const dr = existing.DETAIL_ROW;
            if (dr.DELETED === true && dr.ACTIVED === false) {
              return req.error(
                400,
                "La estrategia ya fue eliminada lógicamente anteriormente."
              );
            }

            await collection.updateOne(filter, {
              $set: { "DETAIL_ROW.DETAIL_ROW_REG.$[].CURRENT": false },
            });

            const updRes = await collection.updateOne(filter, {
              $set: {
                "DETAIL_ROW.ACTIVED": false,
                "DETAIL_ROW.DELETED": true,
              },
              $push: {
                "DETAIL_ROW.DETAIL_ROW_REG": regEntry,
              },
            });

            if (updRes.modifiedCount === 0) {
              throw new Error("No se pudo marcar como eliminada la estrategia");
            }

            return {
              message: `Estrategia con ID '${id}' marcada como eliminada lógicamente.`,
            };
          }
        } catch (error) {
          console.error("Error en deleteStrategy:", error.message);
          return req.error(
            500,
            `Error al eliminar estrategia: ${error.message}`
          );
        }

      default:
        throw new Error(`Acción no soportada: ${action}`);
    }
  } catch (error) {
    console.error("Error en crudStrategies:", error.message);
    throw error;
  }
}

//limit

async function company(req) {
  const Company = require("../models/mongoDB/company.js");
  try {
    // Buscar todas las empresas activas
    const companies = await Company.find({});
    return companies.map((c) => c.toObject());
  } catch (error) {
    console.error("Error en getCompany:", error.message);
    return req.error(500, `Error al obtener empresa(s): ${error.message}`);
  }
}

//Get PricesHistory
async function priceshistory(req) {
  try {
    let result;
    const { idPrice, strategy, productCode } = req?.req?.query || {};

    const collection = mongoose.connection.collection("ZTPRICESHISTORY");

    if (idPrice) {
      result = await collection.find({ idPrice }).toArray();
    } else if (strategy) {
      result = await collection.find({ STRATEGY_NAME: strategy }).toArray();
    } else if (productCode) {
      result = await collection.find({ PRODUCT_CODE: productCode }).toArray();
    } else {
      result = await collection.find({}).toArray();
    }

    return result;
  } catch (error) {
    console.error("Error al obtener registros de ZTPRICESHISTORY:", error);
    throw new Error("Error al obtener registros de ZTPRICESHISTORY");
  }
}

//get strategy
async function strategy(req) {
  const Strategy = require("../models/mongoDB/Strategy.js");

  try {
    // Buscar todas las estrategias sin aplicar filtros
    const strategies = await Strategy.find();

    // Si no se encuentran estrategias, enviar un error 404
    if (strategies.length === 0) {
      return req.error(404, "No se encontraron estrategias.");
    }

    // Devolver todas las estrategias como objetos
    return strategies.map((s) => s.toObject());
  } catch (error) {
    console.error("Error en getStrategy:", error.message);
    return req.error(500, `Error al obtener estrategias: ${error.message}`);
  }
}

// REVERSION_SIMPLE - La lógica de tu estrategia original, ahora como una función separada
async function reversionSimple(req) {
  console.log(req);

  try {
    // Desestructuración de los parámetros requeridos del objeto de solicitud.
    const { SYMBOL, STARTDATE, ENDDATE, AMOUNT, USERID, SPECS } = req || {};

    // Validación de la presencia de todos los parámetros esenciales.
    if (!SYMBOL || !STARTDATE || !ENDDATE || AMOUNT === undefined || !USERID) {
      throw new Error(
        "FALTAN PARÁMETROS REQUERIDOS EN EL CUERPO DE LA SOLICITUD: 'SYMBOL', 'STARTDATE', 'ENDDATE', 'AMOUNT', 'USERID'."
      );
    }

    // Genera un ID de simulación único.
    // Usamos Date y Math.random() como alternativa a crypto.randomUUID()
    // si el entorno no soporta Node.js crypto module directamente.
    const generateSimulationId = (symbol) => {
      const date = new Date();
      const timestamp = date.toISOString().replace(/[^0-9]/g, ""); // Formato YYYYMMDDTHHMMSSsssZ
      const random = Math.floor(Math.random() * 10000);
      return `${symbol}_${timestamp}_${random}`;
    };

    const SIMULATIONID = generateSimulationId(SYMBOL);
    const SIMULATIONNAME = "Reversión Simple"; // Nombre de la estrategia
    const STRATEGYID = "Reversión Simple"; // Ajustado a "IdCM" según el formato deseado

    // Extracción de los períodos para RSI y SMA de las especificaciones, con valores por defecto.
    // CORRECCIÓN: Usar 'INDICATOR' en lugar de 'KEY' para encontrar los indicadores.
    const RSI_INDICATOR = SPECS?.find(
      (IND) => IND.INDICATOR?.toLowerCase() === "rsi"
    );
    const SMA_INDICATOR = SPECS?.find(
      (IND) => IND.INDICATOR?.toLowerCase() === "sma"
    );

    const RSI_PERIOD = parseInt(RSI_INDICATOR?.VALUE) || 14;
    const SMA_PERIOD = parseInt(SMA_INDICATOR?.VALUE) || 5;

    // Configuración de la API de Alpha Vantage.
    // Asegúrate de tener 'axios' importado en tu entorno (ej. const axios = require('axios'); o import axios from 'axios';)
    const APIURL = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${SYMBOL}&outputsize=full&apikey=${APIKEY}`;

    // Realiza la solicitud HTTP para obtener datos históricos.
    const RESPONSE = await axios.get(APIURL);
    const OPTIONSDATA = RESPONSE.data["Time Series (Daily)"];

    // Verifica si se obtuvieron datos históricos.
    if (!OPTIONSDATA || Object.keys(OPTIONSDATA).length === 0) {
      throw new Error(
        "NO SE ENCONTRARON DATOS DE PRECIOS HISTÓRICOS PARA EL SÍMBOLO PROPORCIONADO."
      );
    }

    // Calcula el número de días de "buffer" necesarios para los cálculos de indicadores.
    const BUFFER_DAYS = Math.max(SMA_PERIOD, RSI_PERIOD);

    // Ordena todas las fechas disponibles de los datos históricos.
    const ALL_DATES_SORTED = Object.keys(OPTIONSDATA).sort(
      (A, B) => new Date(A) - new Date(B)
    );

    // Encuentra el índice de inicio ajustado para incluir el buffer de días.
    const EXTENDED_START_INDEX =
      ALL_DATES_SORTED.findIndex((DATE) => DATE >= STARTDATE) - BUFFER_DAYS;

    const ADJUSTED_START_INDEX =
      EXTENDED_START_INDEX >= 0 ? EXTENDED_START_INDEX : 0;

    // Filtra y mapea los precios relevantes para la simulación, incluyendo el buffer.
    const FILTERED_PRICES = ALL_DATES_SORTED.slice(ADJUSTED_START_INDEX)
      .filter((DATE) => DATE <= ENDDATE) // Filtra hasta la fecha de fin
      .map((DATE) => ({
        DATE,
        OPEN: parseFloat(OPTIONSDATA[DATE]["1. open"]),
        HIGH: parseFloat(OPTIONSDATA[DATE]["2. high"]),
        LOW: parseFloat(OPTIONSDATA[DATE]["3. low"]),
        CLOSE: parseFloat(OPTIONSDATA[DATE]["4. close"]),
        VOLUME: parseFloat(OPTIONSDATA[DATE]["5. volume"]),
      }));

    // Verifica si hay suficientes datos para calcular los indicadores.
    if (FILTERED_PRICES.length < BUFFER_DAYS) {
      throw new Error(
        "NO HAY SUFICIENTES DATOS HISTÓRICOS PARA CALCULAR LA ESTRATEGIA CON LOS PERÍODOS ESPECIFICADOS."
      );
    }

    /**
     * Calcula el Simple Moving Average (SMA) para una serie de datos.
     * @param {Array<object>} DATA - Arreglo de objetos de precios con una propiedad 'CLOSE'.
     * @param {number} PERIOD - Período del SMA.
     * @returns {Array<number|null>} - Arreglo de valores SMA o null si no hay suficientes datos.
     */
    const CALCULATE_SMA = (DATA, PERIOD) => {
      const SMA_VALUES = [];
      for (let I = 0; I < DATA.length; I++) {
        if (I < PERIOD - 1) {
          SMA_VALUES.push(null); // No hay suficientes datos para el cálculo inicial
        } else {
          const SUM = DATA.slice(I - PERIOD + 1, I + 1).reduce(
            (ACC, VAL) => ACC + VAL.CLOSE,
            0
          );
          SMA_VALUES.push(SUM / PERIOD);
        }
      }
      return SMA_VALUES;
    };

    // Calcula los valores SMA para los precios filtrados.
    const SMA_VALUES = CALCULATE_SMA(FILTERED_PRICES, SMA_PERIOD);

    // Calcula los valores RSI.
    const RSI_VALUES = [];
    for (let I = 0; I < FILTERED_PRICES.length; I++) {
      if (I < RSI_PERIOD) {
        RSI_VALUES.push(null); // No hay suficientes datos para el cálculo inicial del RSI
        continue;
      }

      let GAINS = 0;
      let LOSSES = 0;
      // Calcula las ganancias y pérdidas para el período RSI.
      for (let J = I - RSI_PERIOD + 1; J <= I; J++) {
        if (J > 0) {
          const CHANGE =
            FILTERED_PRICES[J].CLOSE - FILTERED_PRICES[J - 1].CLOSE;
          if (CHANGE > 0) GAINS += CHANGE;
          else LOSSES -= CHANGE;
        }
      }

      // Calcula el promedio de ganancias y pérdidas.
      const AVG_GAIN = GAINS / RSI_PERIOD;
      const AVG_LOSS = LOSSES / RSI_PERIOD;

      // Calcula el Relative Strength (RS) y el RSI.
      const RS =
        AVG_LOSS === 0 ? (AVG_GAIN === 0 ? 0 : 100) : AVG_GAIN / AVG_LOSS;
      const RSI = 100 - 100 / (1 + RS);
      RSI_VALUES.push(parseFloat(RSI.toFixed(2)));
    }

    // Variables para la simulación de la estrategia.
    const SIGNALS = [];
    let UNITS_HELD = 0; // Unidades del activo en posesión (ahora entero)
    let CASH = parseFloat(AMOUNT); // Capital disponible
    let TOTAL_BOUGHT_UNITS = 0; // Total de unidades compradas a lo largo de la simulación (ahora entero)
    let TOTAL_SOLD_UNITS = 0; // Total de unidades vendidas a lo largo de la simulación (ahora entero)
    const BOUGHT_PRICES = []; // Registro de compras para cálculo FIFO
    let REAL_PROFIT = 0; // Ganancia/pérdida realizada
    const NEW_CHART_DATA = []; // Datos para la visualización en un gráfico (modificado)

    // Bucle principal de la simulación, iterando sobre los precios filtrados.
    for (let I = 0; I < FILTERED_PRICES.length; I++) {
      const {
        DATE,
        OPEN,
        HIGH,
        LOW,
        CLOSE: PRICE, // Renombra CLOSE a PRICE para mayor claridad
        VOLUME,
      } = FILTERED_PRICES[I];

      // Ignora las fechas fuera del rango de simulación (ya filtradas, pero como doble chequeo).
      if (
        new Date(DATE) < new Date(STARTDATE) ||
        new Date(DATE) > new Date(ENDDATE)
      )
        continue;

      const SMA = SMA_VALUES[I];
      const RSI = RSI_VALUES[I];

      let CURRENT_SIGNAL_TYPE = null;
      let CURRENT_REASONING = null;
      let UNITS_TRANSACTED = 0; // Unidades transaccionadas en este paso (ahora entero)
      let PROFIT_LOSS = 0;

      // Lógica de la estrategia: Señal de COMPRA
      // Compra si el precio está significativamente por debajo del SMA y hay efectivo disponible.
      if (PRICE < SMA * 0.98 && CASH > 0) {
        const INVESTMENT_AMOUNT = CASH * 0.5; // Invierte el 50% del efectivo disponible
        // Asegura que las unidades compradas sean un número entero.
        UNITS_TRANSACTED = Math.floor(INVESTMENT_AMOUNT / PRICE);

        // Solo procede si se pueden comprar al menos una unidad
        if (UNITS_TRANSACTED > 0) {
          const SPENT = UNITS_TRANSACTED * PRICE;
          UNITS_HELD += UNITS_TRANSACTED;
          CASH -= SPENT;
          TOTAL_BOUGHT_UNITS += UNITS_TRANSACTED;
          // Registra la compra para el cálculo FIFO.
          BOUGHT_PRICES.push({ DATE, PRICE, UNITS: UNITS_TRANSACTED });

          CURRENT_SIGNAL_TYPE = "buy"; // Cambiado a minúsculas
          CURRENT_REASONING = `EL PRECIO ESTÁ POR DEBAJO DEL 98% DEL SMA. RSI: ${RSI.toFixed(
            2
          )}`;
        }
      }
      // Lógica de la estrategia: Señal de VENTA
      // Vende si el precio está significativamente por encima del SMA y hay unidades en posesión.
      else if (PRICE > SMA * 1.02 && UNITS_HELD > 0) {
        // Asegura que las unidades a vender sean un número entero.
        const UNITS_TO_SELL = Math.floor(UNITS_HELD * 0.25);

        // Solo procede si se pueden vender al menos una unidad
        if (UNITS_TO_SELL > 0) {
          const REVENUE = UNITS_TO_SELL * PRICE;
          CASH += REVENUE;
          UNITS_HELD -= UNITS_TO_SELL;
          TOTAL_SOLD_UNITS += UNITS_TO_SELL;
          UNITS_TRANSACTED = UNITS_TO_SELL;

          // Lógica FIFO para calcular la ganancia/pérdida real de las unidades vendidas.
          let SOLD_UNITS_COUNTER = UNITS_TO_SELL;
          let COST_OF_SOLD_UNITS = 0;
          let UNITS_REMOVED_FROM_BOUGHT = []; // Para limpiar el registro de compras

          for (let J = 0; J < BOUGHT_PRICES.length; J++) {
            if (SOLD_UNITS_COUNTER <= 0) break; // Si ya se vendieron todas las unidades necesarias, salir.

            const PURCHASE = BOUGHT_PRICES[J];
            const UNITS_FROM_THIS_PURCHASE = Math.min(
              PURCHASE.UNITS,
              SOLD_UNITS_COUNTER
            );
            COST_OF_SOLD_UNITS += UNITS_FROM_THIS_PURCHASE * PURCHASE.PRICE;
            SOLD_UNITS_COUNTER -= UNITS_FROM_THIS_PURCHASE; // Ahora son enteros

            BOUGHT_PRICES[J].UNITS -= UNITS_FROM_THIS_PURCHASE; // Ahora son enteros
            if (BOUGHT_PRICES[J].UNITS <= 0) {
              UNITS_REMOVED_FROM_BOUGHT.push(J); // Marca las compras agotadas para eliminación.
            }
          }

          // Elimina las entradas de compras agotadas del registro (en orden inverso para evitar problemas de índice).
          for (let K = UNITS_REMOVED_FROM_BOUGHT.length - 1; K >= 0; K--) {
            BOUGHT_PRICES.splice(UNITS_REMOVED_FROM_BOUGHT[K], 1);
          }

          const AVG_PURCHASE_PRICE_FOR_SOLD_UNITS =
            COST_OF_SOLD_UNITS / UNITS_TO_SELL;
          PROFIT_LOSS =
            (PRICE - AVG_PURCHASE_PRICE_FOR_SOLD_UNITS) * UNITS_TO_SELL;
          REAL_PROFIT += PROFIT_LOSS;

          CURRENT_SIGNAL_TYPE = "sell"; // Cambiado a minúsculas
          CURRENT_REASONING = `EL PRECIO ESTÁ POR ENCIMA DEL 102% DEL SMA. RSI: ${RSI.toFixed(
            2
          )}`;
        }
      }

      // Si se generó una señal (compra o venta), registrarla.
      if (CURRENT_SIGNAL_TYPE) {
        SIGNALS.push({
          DATE,
          TYPE: CURRENT_SIGNAL_TYPE,
          PRICE: parseFloat(PRICE.toFixed(2)),
          REASONING: CURRENT_REASONING,
          SHARES: UNITS_TRANSACTED, // Las unidades ya son enteras
          PROFIT: parseFloat(PROFIT_LOSS.toFixed(2)),
        });
      }

      // Añade los datos para el gráfico con la nueva estructura.
      NEW_CHART_DATA.push({
        DATE,
        OPEN: parseFloat(OPEN.toFixed(2)),
        HIGH: parseFloat(HIGH.toFixed(2)),
        LOW: parseFloat(LOW.toFixed(2)),
        CLOSE: parseFloat(PRICE.toFixed(2)),
        VOLUME: parseFloat(VOLUME.toFixed(0)), // Volumen como entero
        INDICATORS: [
          { INDICATOR: "sma", VALUE: parseFloat((SMA ?? 0).toFixed(2)) },
          { INDICATOR: "rsi", VALUE: parseFloat((RSI ?? 0).toFixed(2)) },
        ],
      });
    }

    // Calcula el valor final de las unidades restantes.
    let FINAL_VALUE = 0;
    const lastPriceData = FILTERED_PRICES[FILTERED_PRICES.length - 1];
    if (lastPriceData && UNITS_HELD > 0) {
      FINAL_VALUE = UNITS_HELD * lastPriceData.CLOSE; // Usar el precio de cierre del último día
    }

    // Calcula el balance final y el porcentaje de retorno.
    const FINAL_BALANCE_CALCULATED = CASH + FINAL_VALUE;
    const PERCENTAGE_RETURN =
      ((FINAL_BALANCE_CALCULATED - AMOUNT) / AMOUNT) * 100;

    // Objeto SUMMARY con los cálculos finales.
    const SUMMARY = {
      TOTAL_BOUGHT_UNITS: TOTAL_BOUGHT_UNITS, // Ahora es entero
      TOTAL_SOLD_UNITS: TOTAL_SOLD_UNITS, // Ahora es entero
      REMAINING_UNITS: UNITS_HELD, // Ahora es entero
      FINAL_CASH: parseFloat(CASH.toFixed(2)),
      FINAL_VALUE: parseFloat(FINAL_VALUE.toFixed(2)),
      FINAL_BALANCE: parseFloat(FINAL_BALANCE_CALCULATED.toFixed(2)),
      REAL_PROFIT: parseFloat(REAL_PROFIT.toFixed(2)),
      PERCENTAGE_RETURN: parseFloat(PERCENTAGE_RETURN.toFixed(2)),
    };

    // Objeto DETAIL_ROW (información de registro).
    const DETAIL_ROW = [
      {
        ACTIVED: true,
        DELETED: false,
        DETAIL_ROW_REG: [
          {
            CURRENT: true,
            REGDATE: new Date().toISOString().slice(0, 10), // Fecha actual YYYY-MM-DD
            REGTIME: new Date().toLocaleTimeString("es-ES", { hour12: false }), // Hora actual HH:MM:SS
            REGUSER: USERID, // Usuario de la solicitud
          },
        ],
      },
    ];

    // Retorna los resultados finales de la simulación con la nueva estructura.

    const simulation = {
      SIMULATIONID,
      USERID,
      STRATEGYID,
      SIMULATIONNAME,
      SYMBOL,
      INDICATORS: { value: SPECS },
      AMOUNT: parseFloat(AMOUNT.toFixed(2)),
      STARTDATE,
      ENDDATE,
      SIGNALS,
      SUMMARY,
      CHART_DATA: NEW_CHART_DATA,
      DETAIL_ROW,
    };

    await mongoose.connection.collection("SIMULATION").insertOne(simulation);
    return {
      SIMULATIONID,
      USERID,
      STRATEGYID,
      SIMULATIONNAME,
      SYMBOL,
      INDICATORS: { value: SPECS },
      AMOUNT: parseFloat(AMOUNT.toFixed(2)),
      STARTDATE,
      ENDDATE,
      SIGNALS,
      SUMMARY,
      CHART_DATA: NEW_CHART_DATA,
      DETAIL_ROW,
    };
  } catch (ERROR) {
    // Manejo de errores, imprime el mensaje de error y lo relanza.
    console.error("ERROR EN LA FUNCIÓN REVERSION_SIMPLE:", ERROR.message);
    throw ERROR;
  }
}

async function simulateSupertrend(req) {
  console.log(req);

  try {
    const { SYMBOL, STARTDATE, ENDDATE, AMOUNT, USERID, SPECS } = req || {};

    if (!SYMBOL || !STARTDATE || !ENDDATE || !AMOUNT || !USERID) {
      throw new Error(
        "FALTAN PARÁMETROS REQUERIDOS EN EL CUERPO DE LA SOLICITUD: 'SYMBOL', 'STARTDATE', 'ENDDATE', 'AMOUNT', 'USERID'."
      );
    }

    if (new Date(ENDDATE) < new Date(STARTDATE)) {
      throw new Error(
        "La fecha de fin  no puede ser anterior a la fecha de inicio."
      );
    }

    // Verificar si AMOUNT es numérico
    if (isNaN(AMOUNT) || typeof AMOUNT !== "number" || AMOUNT <= 0) {
      throw new Error("El monto a invertir debe ser una cantidad válida.");
    }

    //METODO PARA ASIGNAR UN ID A LA SIMULACION BASADO EN LA FECHA
    const generateSimulationId = (SYMBOL) => {
      const date = new Date();
      const timestamp = date.toISOString().replace(/[^0-9]/g, "");
      const random = Math.floor(Math.random() * 10000);
      return `${SYMBOL}_${timestamp}_${random}`;
    };

    const SIMULATIONID = generateSimulationId(SYMBOL);
    const SIMULATIONNAME = "Estrategia Supertrend + MA";
    const STRATEGYID = "idST";

    //Se buscan los identificadores en SPECS
    const MALENGTH =
      parseInt(
        SPECS?.find((i) => i.INDICATOR?.toLowerCase() === "ma_length")?.VALUE
      ) || 20;
    const ATR_PERIOD =
      parseInt(
        SPECS?.find((i) => i.INDICATOR?.toLowerCase() === "atr")?.VALUE
      ) || 10;
    const MULT =
      parseFloat(
        SPECS?.find((i) => i.INDICATOR?.toLowerCase() === "mult")?.VALUE
      ) || 2.0;
    const RR =
      parseFloat(
        SPECS?.find((i) => i.INDICATOR?.toLowerCase() === "rr")?.VALUE
      ) || 1.5;

    if (isNaN(MALENGTH) || isNaN(ATR_PERIOD) || isNaN(MULT) || isNaN(RR)) {
      throw new Error(
        "Los parámetros para la simulación deben ser valores numéricos."
      );
    }
    if (MALENGTH <= 0 || ATR_PERIOD <= 0 || MULT <= 0 || RR <= 0) {
      throw new Error(
        "Los parámetros para la simulación deben ser mayores a 0."
      );
    }

    //Se realiza la consulta de los historicos a AlphaVantage
    const apiKey = process.env.ALPHA_VANTAGE_KEY || "demo";
    const apiUrl = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${SYMBOL}&outputsize=full&apikey=${apiKey}`;
    const resp = await axios.get(apiUrl);

    const rawTs = resp.data["Time Series (Daily)"];
    if (!rawTs) throw new Error("Respuesta inválida de AlphaVantage");

    //Ordena las fechas de forma cronológica
    const allDatesSorted = Object.keys(rawTs).sort(
      (a, b) => new Date(a) - new Date(b)
    );

    //Ajusta el indice de inicio
    const extendedStartIndex =
      allDatesSorted.findIndex((d) => d >= STARTDATE) -
      Math.max(MALENGTH, ATR_PERIOD);
    const adjustedStartIndex = extendedStartIndex >= 0 ? extendedStartIndex : 0; //Si no hay suficientes datos históricos, se inicia desde el primer dato disponible.

    //Filtra y mapea los precios
    const prices = allDatesSorted
      .slice(adjustedStartIndex) //Toma las fechas desde adjustedStartIndex
      .filter((date) => date <= ENDDATE) //Filtra fechas posteriores a ENDDATE
      .map((date) => ({
        //Convierte cada fecha en un objeto con los datos de precio
        DATE: date,
        OPEN: +rawTs[date]["1. open"],
        HIGH: +rawTs[date]["2. high"],
        LOW: +rawTs[date]["3. low"],
        CLOSE: +rawTs[date]["4. close"],
        VOLUME: +rawTs[date]["5. volume"],
      }));

    //Formula para calcular la Media Móvil Simple (SMA)
    const sma = (arr, len) =>
      arr.map((_, i) =>
        i >= len - 1
          ? arr.slice(i - len + 1, i + 1).reduce((a, b) => a + b, 0) / len
          : null
      );

    //Formula para calcular el Average True Range (ATR)

    const atr = (arr, period) => {
      const result = Array(arr.length).fill(null);
      const trValues = []; // Array para almacenar los TR

      for (let i = 1; i < arr.length; i++) {
        const high = arr[i].HIGH;
        const low = arr[i].LOW;
        const prevClose = arr[i - 1].CLOSE;

        // Calcula el TR y lo guarda en el array
        const tr = Math.max(
          high - low,
          Math.abs(high - prevClose),
          Math.abs(low - prevClose)
        );
        trValues.push(tr);

        // Calcula el ATR cuando hay suficientes datos
        if (i >= period) {
          const startIdx = i - period;
          const atr =
            trValues.slice(startIdx, i).reduce((a, b) => a + b, 0) / period;
          result[i] = atr;
        } else {
          result[i] = null;
        }
      }

      return result;
    };
    const closes = prices.map((p) => p.CLOSE); //Se almacena el array de precios de cierre
    const ma = sma(closes, MALENGTH); //Se almacena el array de MA calculado
    const atrVals = atr(prices, ATR_PERIOD); //Se almacena el array de ATR calculado

    let position = null;
    const signals = [];
    let cash = parseFloat(AMOUNT);
    let shares = 0;
    let realProfit = 0;
    const chartData = [];

    for (let i = MALENGTH; i < prices.length; i++) {
      const bar = prices[i];
      const close = bar.CLOSE;
      const trendUp = close > ma[i];
      const trendDown = close < ma[i];
      const stopDistance = atrVals[i] * MULT;
      const profitDistance = stopDistance * RR;

      let currentSignal = null;
      let reasoning = null;
      let profitLoss = 0;
      let sharesTransacted = 0;

      // Lógica de COMPRA (El precio cierra por encima de la MA, y la tendencia es alcista, y el precio del dia anterior estaba por debajo de la MA)
      if (!position && cash > 0 && trendUp && closes[i - 1] < ma[i - 1]) {
        const invest = cash * 1; // Invierto todo el capital disponible, previamente solo se usaba el 50%
        shares = invest / close;
        cash -= invest;
        position = {
          entryPrice: close,
          stop: close - stopDistance,
          limit: close + profitDistance,
        };
        currentSignal = "buy";
        reasoning = "Tendencia alcista identificada.";
        sharesTransacted = shares; // Registrar unidades compradas
      }
      // Lógica de VENTA  (El precio alcanza el nivel objetivo o, el precio cae hasta el nivel del stop-loss o, el precio cierra por debajo de la MA)
      else if (position) {
        if (close >= position.limit || close <= position.stop || trendDown) {
          const soldShares = shares; // Guardar unidades antes de resetear
          cash += soldShares * close;
          profitLoss = (close - position.entryPrice) * soldShares;
          realProfit += profitLoss;
          currentSignal = "sell";
          if (close >= position.limit) {
            reasoning = "Precio objetivo alcanzado.";
          }
          if (close <= position.stop) {
            reasoning = "Stop-loss alcanzado.";
          }
          if (trendDown) {
            reasoning = "Precio por debajo de la MA";
          }
          sharesTransacted = soldShares; // Registrar unidades vendidas
          shares = 0; // Resetear después de registrar
          position = null;
        }
      }

      // Registrar la señal (compra o venta)
      if (currentSignal) {
        signals.push({
          DATE: bar.DATE,
          TYPE: currentSignal,
          PRICE: parseFloat(close.toFixed(2)),
          REASONING: reasoning,
          SHARES: parseFloat(sharesTransacted.toFixed(15)), // Usar sharesTransacted
          PROFIT: parseFloat(profitLoss.toFixed(2)),
        });
      }

      // Datos para el gráfico
      chartData.push({
        ...bar,
        INDICATORS: [
          { INDICATOR: "ma", VALUE: parseFloat((ma[i] ?? 0).toFixed(2)) },
          { INDICATOR: "atr", VALUE: parseFloat((atrVals[i] ?? 0).toFixed(2)) },
        ],
      });
    }

    // Calcular métricas finales
    const finalValue = shares * prices.at(-1).CLOSE;
    const finalBalance = cash + finalValue;
    const percentageReturn = ((finalBalance - AMOUNT) / AMOUNT) * 100;

    const summary = {
      TOTAL_BOUGHT_UNITS: parseFloat(
        signals
          .filter((s) => s.TYPE === "buy")
          .reduce((a, s) => a + s.SHARES, 0)
          .toFixed(5)
      ),
      TOTAL_SOLD_UNITS: parseFloat(
        signals
          .filter((s) => s.TYPE === "sell")
          .reduce((a, s) => a + s.SHARES, 0)
          .toFixed(5)
      ),
      REMAINING_UNITS: parseFloat(shares.toFixed(5)),
      FINAL_CASH: parseFloat(cash.toFixed(2)),
      FINAL_VALUE: parseFloat(finalValue.toFixed(2)),
      FINAL_BALANCE: parseFloat(finalBalance.toFixed(2)),
      REAL_PROFIT: parseFloat(realProfit.toFixed(2)),
      PERCENTAGE_RETURN: parseFloat(percentageReturn.toFixed(2)),
    };

    const detailRow = [
      {
        ACTIVED: true,
        DELETED: false,
        DETAIL_ROW_REG: [
          {
            CURRENT: true,
            REGDATE: new Date().toISOString().slice(0, 10),
            REGTIME: new Date().toLocaleTimeString("es-ES", { hour12: false }),
            REGUSER: USERID,
          },
        ],
      },
    ];

    const simulation = {
      SIMULATIONID,
      USERID,
      STRATEGYID: "Supertrend",
      SIMULATIONNAME,
      SYMBOL,
      INDICATORS: { value: SPECS },
      AMOUNT: parseFloat(AMOUNT.toFixed(2)),
      SUMMARY: summary,
      STARTDATE,
      ENDDATE,
      SIGNALS: signals,
      CHART_DATA: chartData,
      DETAIL_ROW: detailRow,
    };

    await mongoose.connection.collection("SIMULATION").insertOne(simulation);

    return {
      SIMULATIONID,
      USERID,
      STRATEGYID,
      SIMULATIONNAME,
      SYMBOL,
      INDICATORS: { value: SPECS },
      AMOUNT: parseFloat(AMOUNT.toFixed(2)),
      SUMMARY: summary,
      STARTDATE,
      ENDDATE,
      SIGNALS: signals,
      CHART_DATA: chartData,
      DETAIL_ROW: detailRow,
    };
  } catch (error) {
    console.error("Error en simulación de Supertrend + MA:", error);
    throw error;
  }
}

async function SimulateMomentum(req) {
  const { SYMBOL, STARTDATE, ENDDATE, AMOUNT, USERID, SPECS } = req || {};
  console.log(req);
  const numR = Math.floor(Math.random() * 1000).toString();
  //GENERAR ID pa' la estrategia
  const idStrategy = (symbol, usuario) => {
    const date = new Date();
    const timestamp = date.toISOString().slice(0, 10);
    const user = usuario[0];
    return `${symbol}-${timestamp}-${user}-${numR}`;
  };
  //Datos Estaticos para la respuesta
  const SIMULATIONID = idStrategy(SYMBOL, USERID);
  const SIMULATIONNAME = "Estrategia de Momentum-" + numR;
  const STRATEGYID = "MOM";
  console.log(SIMULATIONID);
  // Validación del body.
  const missingParams = [];
  if (!SYMBOL) missingParams.push("SYMBOL");
  if (!STARTDATE) missingParams.push("STARTDATE");
  if (!ENDDATE) missingParams.push("ENDDATE");
  if (AMOUNT === undefined || !AMOUNT) missingParams.push("AMOUNT");
  if (!USERID) missingParams.push("USERID");
  if (missingParams.length > 0) {
    return {
      message: `FALTAN PARÁMETROS REQUERIDOS: ${missingParams.join(", ")}.`,
    };
  }
  // ||||||| <---Usos de la API
  const APIURL = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${SYMBOL}&outputsize=full&apikey=${API_KEY}`;
  const response = await axios.get(APIURL);
  const data = response.data["Time Series (Daily)"]; // objeto por fechas
  const parsedData = Object.entries(data).map(([date, values]) => ({
    DATE: new Date(date).toISOString().slice(0, 10),
    OPEN: parseFloat(values["1. open"]),
    HIGH: parseFloat(values["2. high"]),
    LOW: parseFloat(values["3. low"]),
    CLOSE: parseFloat(values["4. close"]),
    VOLUME: parseFloat(values["5. volume"]),
  }));

  //filtrar por fecha
  function filtrarPorFecha(data, startDate, endDate) {
    return data.filter((item) => {
      let itemdate = new Date(item.DATE).toISOString().slice(0, 10);
      return itemdate >= startDate && itemdate <= endDate;
    });
  }
  function calculateEMA(data, period, key = "CLOSE") {
    const k = 2 / (period + 1);
    let emaArray = [];
    let emaPrev =
      data.slice(0, period).reduce((sum, d) => sum + d[key], 0) / period; // SMA inicial

    for (let i = 0; i < data.length; i++) {
      if (i < period - 1) {
        emaArray.push(null); // no hay suficiente data
      } else if (i === period - 1) {
        emaArray.push(emaPrev);
      } else {
        const price = data[i][key];
        emaPrev = price * k + emaPrev * (1 - k);
        emaArray.push(emaPrev);
      }
    }
    return emaArray;
  }

  function calculateRSI(data, period, key = "CLOSE") {
    let gains = [];
    let losses = [];
    let rsiArray = [];

    for (let i = 1; i < data.length; i++) {
      const change = data[i][key] - data[i - 1][key];
      gains.push(change > 0 ? change : 0);
      losses.push(change < 0 ? -change : 0);
    }

    let avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
    let avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;

    rsiArray = Array(period).fill(null); // Sin RSI para primeros periodos

    for (let i = period; i < gains.length; i++) {
      avgGain = (avgGain * (period - 1) + gains[i]) / period;
      avgLoss = (avgLoss * (period - 1) + losses[i]) / period;

      if (avgLoss === 0) {
        rsiArray.push(100);
      } else {
        const rs = avgGain / avgLoss;
        const rsi = 100 - 100 / (1 + rs);
        rsiArray.push(rsi);
      }
    }

    // rsiArray se calcula desde el índice 1, pero la longitud debe coincidir con data
    rsiArray.unshift(null); // Ajustamos para que sea la misma longitud que data
    return rsiArray;
  }

  function calculateADX(
    data,
    period,
    keyHigh = "HIGH",
    keyLow = "LOW",
    keyClose = "CLOSE"
  ) {
    // Implementación simplificada de ADX

    let tr = [];
    let plusDM = [];
    let minusDM = [];

    for (let i = 1; i < data.length; i++) {
      const high = data[i][keyHigh];
      const low = data[i][keyLow];
      const prevHigh = data[i - 1][keyHigh];
      const prevLow = data[i - 1][keyLow];
      const prevClose = data[i - 1][keyClose];

      const highLow = high - low;
      const highPrevClose = Math.abs(high - prevClose);
      const lowPrevClose = Math.abs(low - prevClose);
      const trueRange = Math.max(highLow, highPrevClose, lowPrevClose);
      tr.push(trueRange);

      const upMove = high - prevHigh;
      const downMove = prevLow - low;

      plusDM.push(upMove > downMove && upMove > 0 ? upMove : 0);
      minusDM.push(downMove > upMove && downMove > 0 ? downMove : 0);
    }

    // Wilder's smoothing
    function smooth(values, period) {
      let smoothed = [];
      let sum = values.slice(0, period).reduce((a, b) => a + b, 0);
      smoothed[period - 1] = sum;
      for (let i = period; i < values.length; i++) {
        smoothed[i] = smoothed[i - 1] - smoothed[i - 1] / period + values[i];
      }
      return smoothed;
    }

    const smoothedTR = smooth(tr, period);
    const smoothedPlusDM = smooth(plusDM, period);
    const smoothedMinusDM = smooth(minusDM, period);

    let plusDI = [];
    let minusDI = [];
    let dx = [];

    for (let i = period - 1; i < smoothedTR.length; i++) {
      plusDI[i] = (smoothedPlusDM[i] / smoothedTR[i]) * 100;
      minusDI[i] = (smoothedMinusDM[i] / smoothedTR[i]) * 100;
      dx[i] =
        (Math.abs(plusDI[i] - minusDI[i]) / (plusDI[i] + minusDI[i])) * 100;
    }

    let adx = [];
    // Primer ADX es promedio de primeros periodos DX
    let initialADX =
      dx.slice(period, period * 2 - 1).reduce((a, b) => a + b, 0) / period;
    for (let i = 0; i < period * 2 - 1; i++) adx.push(null);
    adx.push(initialADX);

    for (let i = period * 2; i < dx.length; i++) {
      const val = (adx[adx.length - 1] * (period - 1) + dx[i]) / period;
      adx.push(val);
    }

    // Ajustar longitud para que coincida con data.length
    while (adx.length < data.length) adx.unshift(null);

    return adx;
  }

  function CalcularIndicadores(parsedData, SPECS) {
    // Valores por defecto si faltan o no tienen VALUE
    const defaults = {
      LONG: 21,
      SHORT: 50,
      RSI: 14,
      ADX: 14,
    };

    // Construir mapa validando VALUE y usando default si no está o es inválido
    const specMap = SPECS.reduce((acc, curr) => {
      const ind = curr.INDICATOR;
      const val =
        typeof curr.VALUE === "number" && !isNaN(curr.VALUE)
          ? curr.VALUE
          : defaults[ind];
      acc[ind] = val !== undefined ? val : defaults[ind];
      return acc;
    }, {});
    //Validacion si falto algun indicador
    const emaShortPeriod = specMap["SHORT"] || defaults.SHORT;
    const emaLongPeriod = specMap["LONG"] || defaults.LONG;
    const rsiPeriod = specMap["RSI"] || defaults.RSI;
    const adxPeriod = specMap["ADX"] || defaults.ADX;
    parsedData.sort((a, b) => new Date(a.DATE) - new Date(b.DATE));
    //se calculan los indicadores
    const emaShort = calculateEMA(parsedData, emaShortPeriod);
    const emaLong = calculateEMA(parsedData, emaLongPeriod);
    const rsi = calculateRSI(parsedData, rsiPeriod);
    const adx = calculateADX(parsedData, adxPeriod);

    return parsedData.map((item, i) => ({
      DATE: new Date(item.DATE).toISOString().slice(0, 10),
      SHORT: emaShort[i],
      LONG: emaLong[i],
      RSI: rsi[i],
      ADX: adx[i],
    }));
  }
  //Calcular los indicadores con todo el historico pq require fechas atras y q hueva filtrar chido
  const calculoIndicadores = CalcularIndicadores(parsedData, SPECS);
  //Los indicadores filtrados por fechas indicadoresFiltrados
  const indicadoresFiltrados = filtrarPorFecha(
    calculoIndicadores,
    STARTDATE,
    ENDDATE
  );
  //El priceHistory filtrado por fecha priceHistoryFiltrado
  const priceHistoryFiltrado = filtrarPorFecha(parsedData, STARTDATE, ENDDATE);
  //console.log(indicadoresFiltrados);
  //console.log(priceHistoryFiltrado);

  //constuir el chart_data ✅
  function ChartData(priceHistoryFiltrado, indicadoresFiltrados) {
    return priceHistoryFiltrado.map((precio) => {
      const fecha = new Date(precio.DATE).toISOString().slice(0, 10);
      const ind = indicadoresFiltrados.find((i) => i.DATE === fecha) || {};

      return {
        DATE: fecha,
        OPEN: precio.OPEN,
        HIGH: precio.HIGH,
        LOW: precio.LOW,
        CLOSE: precio.CLOSE,
        VOLUME: precio.VOLUME,
        INDICATORS: [
          { INDICATOR: "short_ma", VALUE: ind.SHORT ?? null },
          { INDICATOR: "long_ma", VALUE: ind.LONG ?? null },
          { INDICATOR: "rsi", VALUE: ind.RSI ?? null },
          { INDICATOR: "adx", VALUE: ind.ADX ?? null },
        ],
      };
    });
  }

  const chartData = ChartData(priceHistoryFiltrado, indicadoresFiltrados);
  //console.log(chartData);

  //✅
  //Comprobar que dias se cumple con las condiciones de los indicadores y generar las señales
  function simularEstrategiaTrading(
    indicadoresFiltrados,
    historialpricesFiltrado
  ) {
    const señales = [];

    for (let i = 1; i < indicadoresFiltrados.length; i++) {
      const anterior = indicadoresFiltrados[i - 1];
      const actual = indicadoresFiltrados[i];

      const priceDia = historialpricesFiltrado.find(
        (price) =>
          new Date(price.DATE).toISOString().slice(0, 10) ===
          new Date(actual.DATE).toISOString().slice(0, 10)
      );
      if (!priceDia) continue;

      const precio = priceDia.CLOSE;
      const volumenAnterior = historialpricesFiltrado[i - 1]?.VOLUME || 0;
      const volumenActual = priceDia.VOLUME;

      const adxSubiendo = actual.ADX > 25;

      const rsiCondicion = actual.RSI > 55 && actual.RSI < 75;
      const volumenSubiendo = volumenActual > volumenAnterior;
      const cruceAlcista = actual.SHORT > actual.LONG;

      // COMPRA
      if (
        (rsiCondicion && adxSubiendo && volumenSubiendo) ||
        (cruceAlcista && rsiCondicion && adxSubiendo && volumenSubiendo)
      ) {
        señales.push({
          DATE: actual.DATE,
          TYPE: "buy",
          PRICE: precio,
          REASONING: "Golden Cross con RSI, ADX y volumen confirmando momentum",
        });
      }

      // VENTA - basta con que se cumplan 3 de estas
      const cruceBajista =
        anterior.SHORT > anterior.LONG && actual.SHORT < actual.LONG;
      const precioDebajoMAs = precio < actual.SHORT && precio < actual.LONG;
      const rsiBaja = actual.RSI < 55;
      const adxDebil = actual.ADX < 20;
      const volumenNegativo =
        (precio > anterior.CLOSE && volumenActual < volumenAnterior) ||
        (precio < anterior.CLOSE && volumenActual > volumenAnterior);

      const señalesVenta = [
        cruceBajista,
        precioDebajoMAs,
        rsiBaja,
        adxDebil,
        volumenNegativo,
      ].filter(Boolean).length;

      if (señalesVenta >= 3) {
        señales.push({
          DATE: actual.DATE,
          TYPE: "sell",
          PRICE: precio,
          REASONING:
            "Múltiples señales de salida detectadas (cruce bajista, RSI bajando, ADX débil, volumen dudoso)",
        });
      }
    }

    return { SEÑALES: señales };
  }

  //✅ Aplicar la estrategia los dias de las señales
  //Vender primero lo primero que se compro, no vender hasta que haya comprado
  //✅ Generar el resumen financiero
  function calcularResumenFinanciero(señales, PHF, capitalInicial) {
    let lotes = []; // [{ cantidad, price, fecha }]
    let efectivo = capitalInicial;
    const señalesEjecutadas = [];

    let totalComprado = 0;
    let totalVendido = 0;
    let costoTotalComprado = 0;
    let gananciaReal = 0;

    for (const señal of señales) {
      const { DATE, TYPE, PRICE, REASONING } = señal;

      if (TYPE === "buy") {
        const acciones = +(efectivo / PRICE).toFixed(6);
        if (acciones > 0) {
          efectivo -= acciones * PRICE;
          lotes.push({
            cantidad: acciones,
            price: PRICE,
            fecha: new Date(DATE),
          });

          totalComprado += acciones;
          costoTotalComprado += acciones * PRICE;

          señalesEjecutadas.push({
            DATE,
            TYPE,
            PRICE,
            REASONING,
            SHARES: acciones,
          });
        }
      } else if (TYPE === "sell") {
        let totalAcciones = lotes.reduce((sum, lote) => sum + lote.cantidad, 0);
        let accionesVendidas = 0;
        if (totalAcciones > 0) {
          let accionesAVender = totalAcciones;

          let ingreso = 0;
          let costoVenta = 0;

          lotes.sort((a, b) => a.fecha - b.fecha); // FIFO

          for (let i = 0; i < lotes.length && accionesAVender > 0; i++) {
            const lote = lotes[i];
            const cantidad = Math.min(lote.cantidad, accionesAVender);
            ingreso += cantidad * PRICE;
            costoVenta += cantidad * lote.price;
            lote.cantidad -= cantidad;
            accionesAVender -= cantidad;
            accionesVendidas += cantidad;
          }

          lotes = lotes.filter((l) => l.cantidad > 0); // Eliminar lotes vacíos
          efectivo += ingreso;

          totalVendido += accionesVendidas;
          gananciaReal += ingreso - costoVenta;
        }
        señalesEjecutadas.push({
          DATE,
          TYPE,
          PRICE,
          REASONING,
          SHARES: accionesVendidas,
        });
      }
    }

    const accionesRestantes = lotes.reduce(
      (sum, lote) => sum + lote.cantidad,
      0
    );
    // Obtener price de cierre del último día
    const priceFinal = PHF.length > 0 ? PHF[PHF.length - 1].CLOSE : 0;

    const resumen = {
      TOTAL_BOUGHT_UNITS: +totalComprado.toFixed(4),
      TOTAL_SOLD_UNITS: +totalVendido.toFixed(4),
      REMAINING_UNITS: +(totalComprado - totalVendido).toFixed(4),
      FINAL_CASH: +efectivo.toFixed(2),
      FINAL_VALUE: +(
        priceFinal !== null ? accionesRestantes * priceFinal : 0
      ).toFixed(2),
      FINAL_BALANCE: +(
        efectivo + (priceFinal !== null ? accionesRestantes * priceFinal : 0)
      ).toFixed(2),
      REAL_PROFIT: +gananciaReal.toFixed(2),
    };

    return {
      SUMMARY: resumen,
      SIGNALS: señalesEjecutadas,
    };
  }

  //REVISAR SI ESTA BIEN ESTAS COSAS
  const resultadoSimulacion = simularEstrategiaTrading(
    indicadoresFiltrados,
    priceHistoryFiltrado
  );
  const resumen = calcularResumenFinanciero(
    resultadoSimulacion.SEÑALES,
    priceHistoryFiltrado,
    AMOUNT
  );

  //detail row

  //resultado de la simulacion
  const simulacion = {
    SIMULATIONID,
    USERID,
    STRATEGYID,
    SIMULATIONNAME,
    SYMBOL,
    INDICATORS: SPECS,
    AMOUNT,
    STARTDATE,
    ENDDATE,
    SIGNALS: resumen.SIGNALS,
    SUMMARY: resumen.SUMMARY,
    CHART_DATA: chartData,
    DETAIL_ROW: {
      ACTIVED: true,
      DELETED: false,
      DETAIL_ROW_REG: [
        {
          CURRENT: true,
          REGDATE: new Date().toISOString().slice(0, 10), // Formato "YYYY-MM-DD"
          REGTIME: new Date().toTimeString().slice(0, 8), // Formato "HH:MM:SS"
          REGUSER: USERID,
        },
      ],
    },
  };

  try {
    await mongoose.connection.collection("SIMULATION").insertOne(simulacion);

    console.log("Simulacion guardada en la base de datos.");
    //console.log(nuevaSimulacion);
  } catch (error) {
    return {
      status: 500,
      message: error.message,
    };
  }

  return {
    simulacion,
  };
}

// Función auxiliar para calcular stop-loss
function findStopLoss(type, data, currentIndex) {
  const lookback = 20;
  const startIndex = Math.max(0, currentIndex - lookback);
  const slice = data.slice(startIndex, currentIndex);

  if (type === "buy") {
    const minLow = Math.min(...slice.map((d) => d.price_history.low));
    return minLow * 0.99;
  } else {
    const maxHigh = Math.max(...slice.map((d) => d.price_history.high));
    return maxHigh * 1.01;
  }
}

function calculateMovingAverageData(
  fullHistory,
  startDate,
  endDate,
  shortMa,
  longMa
) {
  if (!fullHistory || fullHistory.length === 0) {
    throw new Error("Full history data is required");
  }

  let startIndex = 0;
  if (startDate) {
    startIndex = fullHistory.findIndex(
      (item) => item && item.date >= new Date(startDate)
    );
    if (startIndex === -1) startIndex = fullHistory.length - 1;
    startIndex = Math.max(0, startIndex - longMa);
  }

  let workingData = fullHistory.slice(startIndex);
  if (endDate) {
    workingData = workingData.filter(
      (item) => item && item.date <= new Date(endDate)
    );
  }

  // Validación de datos de trabajo
  if (workingData.length === 0) {
    throw new Error("No data available for the selected date range");
  }

  const dataWithMAs = workingData
    .map((item, index, array) => {
      if (!item || !item.close) {
        console.warn(`Invalid item at index ${index}`);
        return null;
      }

      const shortSlice = array.slice(
        Math.max(0, index - shortMa + 1),
        index + 1
      );
      const longSlice = array.slice(Math.max(0, index - longMa + 1), index + 1);

      return {
        price_history: {
          ...item,
          date: item.date,
        },
        short_ma:
          shortSlice.length >= shortMa
            ? shortSlice.reduce(
                (sum, p) => (p && p.close ? sum + p.close : sum),
                0
              ) / shortMa
            : null,
        long_ma:
          longSlice.length >= longMa
            ? longSlice.reduce(
                (sum, p) => (p && p.close ? sum + p.close : sum),
                0
              ) / longMa
            : null,
      };
    })
    .filter(
      (item) =>
        item !== null &&
        item.price_history &&
        item.price_history.date &&
        item.short_ma !== null &&
        item.long_ma !== null
    );
  const signals = [];
  let currentPosition = null;
  let entryPrice = 0;
  let stopLoss = 0;
  let takeProfit = 0;

  for (let i = 1; i < dataWithMAs.length; i++) {
    const prev = dataWithMAs[i - 1];
    const current = dataWithMAs[i];

    if (prev.short_ma < prev.long_ma && current.short_ma > current.long_ma) {
      if (currentPosition !== "buy") {
        entryPrice = current.price_history.close;
        stopLoss = findStopLoss("buy", dataWithMAs, i);
        takeProfit = entryPrice + 2 * (entryPrice - stopLoss);

        signals.push({
          date: current.price_history.date,
          type: "buy",
          price: entryPrice,
          reasoning: `Golden Cross: ${shortMa}MA crossed above ${longMa}MA`,
          stopLoss,
          takeProfit,
        });

        currentPosition = "buy";
      }
    } else if (
      prev.short_ma > prev.long_ma &&
      current.short_ma < current.long_ma
    ) {
      if (currentPosition !== "sell") {
        entryPrice = current.price_history.close;
        stopLoss = findStopLoss("sell", dataWithMAs, i);
        takeProfit = entryPrice - 2 * (stopLoss - entryPrice);

        signals.push({
          date: current.price_history.date,
          type: "sell",
          price: entryPrice,
          reasoning: `Death Cross: ${shortMa}MA crossed below ${longMa}MA`,
          stopLoss,
          takeProfit,
        });

        currentPosition = "sell";
      }
    } else if (currentPosition === "buy") {
      if (current.price_history.low <= stopLoss) {
        signals.push({
          date: current.price_history.date,
          type: "sell",
          price: stopLoss,
          reasoning: `Stop-loss triggered at ${stopLoss}`,
          isStopLoss: true,
        });
        currentPosition = null;
      } else if (current.price_history.high >= takeProfit) {
        signals.push({
          date: current.price_history.date,
          type: "sell",
          price: takeProfit,
          reasoning: `Take-profit triggered at ${takeProfit}`,
          isTakeProfit: true,
        });
        currentPosition = null;
      }
    } else if (currentPosition === "sell") {
      if (current.price_history.high >= stopLoss) {
        signals.push({
          date: current.price_history.date,
          type: "buy",
          price: stopLoss,
          reasoning: `Stop-loss triggered at ${stopLoss}`,
          isStopLoss: true,
        });
        currentPosition = null;
      } else if (current.price_history.low <= takeProfit) {
        signals.push({
          date: current.price_history.date,
          type: "buy",
          price: takeProfit,
          reasoning: `Take-profit triggered at ${takeProfit}`,
          isTakeProfit: true,
        });
        currentPosition = null;
      }
    }
  }

  if (currentPosition && signals.length > 0) {
    const lastSignal = signals[signals.length - 1];
    const lastPrice = dataWithMAs[dataWithMAs.length - 1].price_history.close;

    signals.push({
      date: dataWithMAs[dataWithMAs.length - 1].price_history.date,
      type: currentPosition === "buy" ? "sell" : "buy",
      price: lastPrice,
      reasoning: `Final position closed at end of period`,
      isFinal: true,
    });
  }

  return {
    priceData: dataWithMAs.map((item) => ({
      date: item.price_history.date,
      open: item.price_history.open,
      high: item.price_history.high,
      low: item.price_history.low,
      close: item.price_history.close,
      volume: item.price_history.volume,
      short_ma: item.short_ma,
      long_ma: item.long_ma,
    })),
    signals: signals,
  };
}

function parseSpecs(specsArray) {
  const defaults = { SHORT_MA: 50, LONG_MA: 200 };

  if (!Array.isArray(specsArray)) return defaults;

  const result = { ...defaults };

  specsArray.forEach((item) => {
    if (!item || !item.INDICATOR) return;

    const key = item.INDICATOR.toUpperCase();
    const value = parseInt(item.VALUE);

    if (!isNaN(value)) {
      if (key === "SHORT_MA" && value >= 5) {
        result.SHORT_MA = value;
      } else if (key === "LONG_MA" && value >= 20) {
        result.LONG_MA = value;
      }
    }
  });

  // Validar que SHORT_MA sea menor que LONG_MA
  if (result.SHORT_MA >= result.LONG_MA) {
    result.LONG_MA = result.SHORT_MA + 50;
  }

  return result;
}
async function SimulateMACrossover(body) {
  try {
    // Versión adaptada al controlador existente
    // body ya es el objeto SIMULATION que viene del controlador
    const { SYMBOL, STARTDATE, ENDDATE, AMOUNT, USERID, SPECS } = body;

    // Validación de parámetros
    const requiredFields = [
      "SYMBOL",
      "STARTDATE",
      "ENDDATE",
      "AMOUNT",
      "USERID",
      "SPECS",
    ];
    const missingFields = requiredFields.filter((field) => !body[field]);

    if (missingFields.length > 0) {
      throw new Error(
        `Faltan campos requeridos en SIMULATION: ${missingFields.join(", ")}`
      );
    }

    // Obtener datos históricos
    const url = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${SYMBOL}&outputsize=full&apikey=${process.env.ALPHA_VANTAGE_API_KEY}`;
    const response = await axios.get(url);

    if (!response.data || !response.data["Time Series (Daily)"]) {
      throw new Error("Invalid data format from Alpha Vantage API");
    }

    const timeSeries = response.data["Time Series (Daily)"];

    // Procesar datos históricos
    let history = Object.entries(timeSeries)
      .map(([date, data]) => {
        if (!data || !data["4. close"]) {
          console.warn(`Datos incompletos para la fecha ${date}`);
          return null;
        }
        return {
          date: new Date(date),
          open: parseFloat(data["1. open"]),
          high: parseFloat(data["2. high"]),
          low: parseFloat(data["3. low"]),
          close: parseFloat(data["4. close"]),
          volume: parseInt(data["5. volume"]),
        };
      })
      .filter((item) => item !== null)
      .sort((a, b) => a.date - b.date);

    if (history.length === 0) {
      throw new Error("No valid historical data found");
    }

    // Parsear especificaciones
    const { SHORT_MA: shortMa, LONG_MA: longMa } = parseSpecs(SPECS);

    // Calcular medias móviles y señales
    const { priceData, signals } = calculateMovingAverageData(
      history,
      STARTDATE,
      ENDDATE,
      shortMa,
      longMa
    );

    // Simular transacciones
    let currentCash = AMOUNT;
    let sharesHeld = 0;
    let totalBought = 0;
    let totalSold = 0;

    const processedSignals = signals
      .map((signal) => {
        if (signal.type === "buy" && currentCash > 0) {
          const shares = currentCash / signal.price;
          sharesHeld += shares;
          totalBought += shares;
          currentCash = 0;

          return {
            DATE: signal.date.toISOString().slice(0, 10),
            TYPE: "buy",
            PRICE: signal.price,
            REASONING: signal.reasoning,
            SHARES: shares,
          };
        } else if (signal.type === "sell" && sharesHeld > 0) {
          const proceeds = sharesHeld * signal.price;
          totalSold += sharesHeld;
          currentCash += proceeds;
          const shares = sharesHeld;
          sharesHeld = 0;

          return {
            DATE: signal.date,
            TYPE: "sell",
            PRICE: signal.price,
            REASONING: signal.reasoning,
            SHARES: shares,
          };
        }
        return null;
      })
      .filter(Boolean);

    // Cerrar posición final si queda algo abierto
    if (sharesHeld > 0) {
      const lastPrice = priceData[priceData.length - 1].close;
      const proceeds = sharesHeld * lastPrice;
      totalSold += sharesHeld;
      currentCash += proceeds;

      processedSignals.push({
        DATE: priceData[priceData.length - 1].date,
        TYPE: "sell",
        PRICE: lastPrice,
        REASONING: "Final position closed at end of period",
        SHARES: sharesHeld,
      });

      sharesHeld = 0;
    }

    // Calcular métricas finales
    const finalValue = sharesHeld * priceData[priceData.length - 1].close;
    const finalBalance = currentCash + finalValue;
    const profit = finalBalance - AMOUNT;
    const percentageReturn = (profit / AMOUNT) * 100;

    // Formatear datos para el gráfico
    const chartData = priceData.map((item) => ({
      DATE: item.date.toISOString().slice(0, 10),
      OPEN: item.open,
      HIGH: item.high,
      LOW: item.low,
      CLOSE: item.close,
      VOLUME: item.volume,
      INDICATORS: [
        { INDICATOR: "short_ma", VALUE: item.short_ma },
        { INDICATOR: "long_ma", VALUE: item.long_ma },
      ],
    }));

    // Formatear SPECS como string
    const formattedSpecs = [
      { INDICATOR: "SHORT_MA", VALUE: shortMa },
      { INDICATOR: "LONG_MA", VALUE: longMa },
    ];

    // Crear objeto de simulación
    const simulationData = {
      SIMULATIONID: `${SYMBOL}_${new Date()
        .toISOString()
        .replace(/[:.]/g, "-")
        .replace("T", "_")}`,
      USERID,
      STRATEGYID: "MACrossover",
      SIMULATIONNAME: `MA Crossover ${shortMa}/${longMa}`,
      SYMBOL,
      STARTDATE: new Date(STARTDATE).toISOString().slice(0, 10),
      ENDDATE: new Date(ENDDATE).toISOString().slice(0, 10),
      AMOUNT,
      SIGNALS: processedSignals,
      SPECS: formattedSpecs,
      SUMMARY: {
        TOTAL_BOUGHT_UNITS: totalBought,
        TOTAL_SOLDUNITS: totalSold,
        REMAINING_UNITS: sharesHeld,
        FINAL_CASH: currentCash,
        FINAL_VALUE: finalValue,
        FINAL_BALANCE: finalBalance,
        REAL_PROFIT: profit,
        PERCENTAGE_RETURN: percentageReturn,
      },
      CHART_DATA: chartData,
      DETAIL_ROW: {
        ACTIVED: true,
        DELETED: false,
        DETAIL_ROW_REG: [
          {
            CURRENT: true,
            REGDATE: new Date(),
            REGTIME: new Date().toTimeString().split(" ")[0],
            REGUSER: USERID,
          },
        ],
      },
    };

    // Guardar en MongoDB
    await mongoose.connection
      .collection("SIMULATION")
      .insertOne(simulationData);

    return simulationData;
  } catch (e) {
    console.error("Error in SimulateMACrossover:", {
      message: e.message,
      stack: e.stack,
      inputBody: body,
    });
    throw new Error(`Simulation failed: ${e.message}`);
  }
}

module.exports = {
  crudSimulation,
  crudStrategies,
  company,
  strategy,
  priceshistory,
  reversionSimple,
  simulateSupertrend,
  SimulateMomentum,
  SimulateMACrossover,
};
