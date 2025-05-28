const { message } = require("@sap/cds/lib/log/cds-error");
const mongoose = require("mongoose");

async function CrudUsers(req) {
  try {
    const action = req.req.query.action;

    if (!action) {
      throw new Error("El parámetro 'action' es obligatorio.");
    }

    switch (action) {
      case "get": // Servicio para obtener usuarios con sus roles, procesos, vistas y aplicaciones
        try {
          let result;

          const userid = req?.req?.query?.userid;

          if (!userid) {
            result = await mongoose.connection
              .collection("ZTUSERS")
              .aggregate([
                {
                  $lookup: {
                    from: "ZTROLES",
                    localField: "ROLES.ROLEID",
                    foreignField: "ROLEID",
                    as: "ROLE_DETAILS",
                  },
                },
                { $unwind: "$ROLES" },
                {
                  $addFields: {
                    ROLE_DETAIL: {
                      $arrayElemAt: [
                        {
                          $filter: {
                            input: "$ROLE_DETAILS",
                            as: "detail",
                            cond: { $eq: ["$$detail.ROLEID", "$ROLES.ROLEID"] },
                          },
                        },
                        0,
                      ],
                    },
                  },
                },
                { $unwind: "$ROLE_DETAIL.PRIVILEGES" },
                {
                  $lookup: {
                    from: "ZTVALUES",
                    let: { processId: "$ROLE_DETAIL.PRIVILEGES.PROCESSID" },
                    pipeline: [
                      {
                        $match: {
                          $expr: {
                            $and: [
                              { $eq: ["$LABELID", "IdProcesses"] },
                              {
                                $eq: [
                                  { $concat: ["IdProcess-", "$VALUEID"] },
                                  "$$processId",
                                ],
                              },
                            ],
                          },
                        },
                      },
                      {
                        $lookup: {
                          from: "ZTVALUES",
                          let: { viewId: "$VALUEPAID" },
                          pipeline: [
                            {
                              $match: {
                                $expr: {
                                  $and: [
                                    { $eq: ["$LABELID", "IdViews"] },
                                    {
                                      $eq: [
                                        { $concat: ["IdViews-", "$VALUEID"] },
                                        "$$viewId",
                                      ],
                                    },
                                  ],
                                },
                              },
                            },
                            {
                              $lookup: {
                                from: "ZTVALUES",
                                let: { appId: "$VALUEPAID" },
                                pipeline: [
                                  {
                                    $match: {
                                      $expr: {
                                        $and: [
                                          {
                                            $eq: ["$LABELID", "IdApplications"],
                                          },
                                          {
                                            $eq: [
                                              {
                                                $concat: [
                                                  "IdApplications-",
                                                  "$VALUEID",
                                                ],
                                              },
                                              "$$appId",
                                            ],
                                          },
                                        ],
                                      },
                                    },
                                  },
                                ],
                                as: "application",
                              },
                            },
                            {
                              $addFields: {
                                application: {
                                  $arrayElemAt: ["$application", 0],
                                },
                              },
                            },
                          ],
                          as: "view",
                        },
                      },
                      {
                        $addFields: {
                          view: { $arrayElemAt: ["$view", 0] },
                        },
                      },
                    ],
                    as: "PROCESS_INFO",
                  },
                },
                {
                  $addFields: {
                    PROCESS_INFO: { $arrayElemAt: ["$PROCESS_INFO", 0] },
                  },
                },
                {
                  $group: {
                    _id: {
                      userId: "$_id",
                      roleId: "$ROLES.ROLEID",
                      processId: "$ROLE_DETAIL.PRIVILEGES.PROCESSID",
                    },
                    PROCESS: {
                      $first: {
                        PROCESSID: "$ROLE_DETAIL.PRIVILEGES.PROCESSID",
                        PROCESSNAME: "$PROCESS_INFO.VALUE",
                        VIEWID: "$PROCESS_INFO.view.VALUEID",
                        VIEWNAME: "$PROCESS_INFO.view.VALUE",
                        APPLICATIONID: "$PROCESS_INFO.view.application.VALUEID",
                        APPLICATIONNAME: "$PROCESS_INFO.view.application.VALUE",
                        PRIVILEGES: {
                          $map: {
                            input: "$ROLE_DETAIL.PRIVILEGES.PRIVILEGEID",
                            as: "privId",
                            in: {
                              PRIVILEGEID: "$$privId",
                              PRIVILEGENAME: "$$privId",
                            },
                          },
                        },
                      },
                    },
                    ROLE_META: { $first: "$ROLES" },
                    ROLE_DETAILS: {
                      $first: {
                        ROLEID: "$ROLE_DETAIL.ROLEID",
                        ROLENAME: "$ROLE_DETAIL.ROLENAME",
                        DESCRIPTION: "$ROLE_DETAIL.DESCRIPTION",
                        DETAIL_ROW: "$ROLE_DETAIL.DETAIL_ROW",
                      },
                    },
                    USER: { $first: "$$ROOT" },
                  },
                },
                {
                  $group: {
                    _id: {
                      userId: "$_id.userId",
                      roleId: "$_id.roleId",
                    },
                    ROLEID: { $first: "$ROLE_META.ROLEID" },
                    ROLEIDSAP: { $first: "$ROLE_META.ROLEIDSAP" },
                    ROLENAME: { $first: "$ROLE_DETAILS.ROLENAME" },
                    DESCRIPTION: { $first: "$ROLE_DETAILS.DESCRIPTION" },
                    DETAIL_ROW: { $first: "$ROLE_DETAILS.DETAIL_ROW" },
                    PROCESSES: { $push: "$PROCESS" },
                    USER: { $first: "$USER" },
                  },
                },
                {
                  $group: {
                    _id: "$_id.userId",
                    ROLES: {
                      $push: {
                        ROLEID: "$ROLEID",
                        ROLEIDSAP: "$ROLEIDSAP",
                        ROLENAME: "$ROLENAME",
                        DESCRIPTION: "$DESCRIPTION",
                        DETAIL_ROW: "$DETAIL_ROW",
                        PROCESSES: "$PROCESSES",
                      },
                    },
                    USER: { $first: "$USER" },
                  },
                },
                {
                  $project: {
                    _id: 0,
                    USERID: "$USER.USERID",
                    PASSWORD: "$USER.PASSWORD",
                    USERNAME: "$USER.USERNAME",
                    ALIAS: "$USER.ALIAS",
                    FIRSTNAME: "$USER.FIRSTNAME",
                    LASTNAME: "$USER.LASTNAME",
                    BIRTHDAYDATE: "$USER.BIRTHDAYDATE",
                    COMPANYID: "$USER.COMPANYID",
                    COMPANYNAME: "$USER.COMPANYNAME",
                    COMPANYALIAS: "$USER.COMPANYALIAS",
                    CEDIID: "$USER.CEDIID",
                    EMPLOYEEID: "$USER.EMPLOYEEID",
                    EMAIL: "$USER.EMAIL",
                    PHONENUMBER: "$USER.PHONENUMBER",
                    EXTENSION: "$USER.EXTENSION",
                    DEPARTMENT: "$USER.DEPARTMENT",
                    FUNCTION: "$USER.FUNCTION",
                    AVATAR: "$USER.AVATAR",
                    BALANCE: "$USER.BALANCE",
                    STREET: "$USER.STREET",
                    POSTALCODE: "$USER.POSTALCODE",
                    CITY: "$USER.CITY",
                    REGION: "$USER.REGION",
                    STATE: "$USER.STATE",
                    COUNTRY: "$USER.COUNTRY",
                    AVATAR: "$USER.AVATAR",
                    DETAIL_ROW: "$USER.DETAIL_ROW",
                    ROLES: "$ROLES",
                  },
                },
              ])
              .toArray();
          } else {
            result = await mongoose.connection
              .collection("ZTUSERS")
              .aggregate([
                {
                  $match: { USERID: userid },
                },
                {
                  $lookup: {
                    from: "ZTROLES",
                    localField: "ROLES.ROLEID",
                    foreignField: "ROLEID",
                    as: "ROLE_DETAILS",
                  },
                },
                { $unwind: "$ROLES" },
                {
                  $addFields: {
                    ROLE_DETAIL: {
                      $arrayElemAt: [
                        {
                          $filter: {
                            input: "$ROLE_DETAILS",
                            as: "detail",
                            cond: { $eq: ["$$detail.ROLEID", "$ROLES.ROLEID"] },
                          },
                        },
                        0,
                      ],
                    },
                  },
                },
                { $unwind: "$ROLE_DETAIL.PRIVILEGES" },
                {
                  $lookup: {
                    from: "ZTVALUES",
                    let: { processId: "$ROLE_DETAIL.PRIVILEGES.PROCESSID" },
                    pipeline: [
                      {
                        $match: {
                          $expr: {
                            $and: [
                              { $eq: ["$LABELID", "IdProcesses"] },
                              {
                                $eq: [
                                  { $concat: ["IdProcess-", "$VALUEID"] },
                                  "$$processId",
                                ],
                              },
                            ],
                          },
                        },
                      },
                      {
                        $lookup: {
                          from: "ZTVALUES",
                          let: { viewId: "$VALUEPAID" },
                          pipeline: [
                            {
                              $match: {
                                $expr: {
                                  $and: [
                                    { $eq: ["$LABELID", "IdViews"] },
                                    {
                                      $eq: [
                                        { $concat: ["IdViews-", "$VALUEID"] },
                                        "$$viewId",
                                      ],
                                    },
                                  ],
                                },
                              },
                            },
                            {
                              $lookup: {
                                from: "ZTVALUES",
                                let: { appId: "$VALUEPAID" },
                                pipeline: [
                                  {
                                    $match: {
                                      $expr: {
                                        $and: [
                                          {
                                            $eq: ["$LABELID", "IdApplications"],
                                          },
                                          {
                                            $eq: [
                                              {
                                                $concat: [
                                                  "IdApplications-",
                                                  "$VALUEID",
                                                ],
                                              },
                                              "$$appId",
                                            ],
                                          },
                                        ],
                                      },
                                    },
                                  },
                                ],
                                as: "application",
                              },
                            },
                            {
                              $addFields: {
                                application: {
                                  $arrayElemAt: ["$application", 0],
                                },
                              },
                            },
                          ],
                          as: "view",
                        },
                      },
                      {
                        $addFields: {
                          view: { $arrayElemAt: ["$view", 0] },
                        },
                      },
                    ],
                    as: "PROCESS_INFO",
                  },
                },
                {
                  $addFields: {
                    PROCESS_INFO: { $arrayElemAt: ["$PROCESS_INFO", 0] },
                  },
                },
                {
                  $group: {
                    _id: "$USERID",
                    USERNAME: { $first: "$USERNAME" },
                    EMAIL: { $first: "$EMAIL" },
                    PASSWORD: { $first: "$PASSWORD" },
                    ROLES: {
                      $push: {
                        ROLEID: "$ROLES.ROLEID",
                        ACTIVE: "$ROLES.ACTIVE",
                        PRIVILEGES: {
                          PROCESSID: "$ROLE_DETAIL.PRIVILEGES.PROCESSID",
                          ACTIONS: "$ROLE_DETAIL.PRIVILEGES.ACTIONS",
                          PROCESS_INFO: "$PROCESS_INFO",
                        },
                      },
                    },
                  },
                },
              ])
              .toArray();
              //Verificar contraseña es correcta
              /*
              const passwordIngresada = '1234e';
              console.log(`Password ingresada: ${passwordIngresada}`);
              if (passwordIngresada && result.length > 0) {
                const bcrypt = require("bcrypt");
                const hashAlmacenado = result[0].PASSWORD;
                const isMatch = await bcrypt.compare(passwordIngresada, hashAlmacenado);
                console.log(`¿Password correcta? ${isMatch}`);
                // Puedes agregar el resultado al objeto de respuesta para pruebas:
                result[0].passwordCorrecta = isMatch;
              }*/
              
              
          }
          
          return result;
        } catch (error) {
          throw new Error(error.message);
        }
      case "create":
        try {
          const {
            USERID,
            PASSWORD,
            USERNAME,
            ALIAS,
            FIRSTNAME,
            LASTNAME,
            EMAIL,
            EXTENSION,
            PHONENUMBER,
            BIRTHDAYDATE,
            EMPLOYEEID,
            COMPANYID,
            COMPANYNAME,
            COMPANYALIAS,
            CEDIID,
            AVATAR,
            BALANCE,
            DEPARTMENT,
            FUNCTION,
            STREET,
            POSTALCODE,
            CITY,
            REGION,
            STATE,
            COUNTRY,
            ROLES,
            reguser,
          } = req?.req?.body?.users;

          const currentDate = new Date();

          // Sección para DETAIL_ROW_REG
          const detailRowReg = [
            {
              CURRENT: false,
              REGDATE: currentDate,
              REGTIME: currentDate,
              REGUSER: reguser,
            },
            {
              CURRENT: true,
              REGDATE: currentDate,
              REGTIME: currentDate,
              REGUSER: reguser,
            },
          ];

          const existente = await mongoose.connection
            .collection("ZTUSERS")
            .findOne({ USERID: USERID });
          if (existente) {
            throw new Error("El USERID ya existe.");
          }

          // Verificación de existencia de roles en la colección ZTROLES
          const roleIds = ROLES?.map((role) => role.ROLEID) || [];

          const existingRoles = await mongoose.connection
            .collection("ZTROLES")
            .find({ ROLEID: { $in: roleIds } })
            .project({ ROLEID: 1 }) // Solo obtenemos el campo ROLEID
            .toArray();

          const existingRoleIds = existingRoles.map((role) => role.ROLEID);

          const missingRoles = roleIds.filter(
            (roleId) => !existingRoleIds.includes(roleId)
          );

          if (missingRoles.length > 0) {
            return {
              message: "Algunos roles no existen en ZTROLES",
              missingRoles,
            };
          }
        
          // Crear el nuevo objeto de usuario
          const newUser = {
            USERID,
            USERNAME,
            PASSWORD,
            ALIAS: ALIAS || "",
            FIRSTNAME,
            LASTNAME,
            EMPLOYEEID: EMPLOYEEID || "",
            EXTENSION: EXTENSION || "",
            PHONENUMBER: PHONENUMBER || "",
            EMAIL,
            BIRTHDAYDATE: BIRTHDAYDATE || "",
            AVATAR: AVATAR || "",
            COMPANYID: COMPANYID || "",
            COMPANYNAME: COMPANYNAME || "",
            COMPANYALIAS: COMPANYALIAS || "",
            CEDIID: CEDIID || "",
            DEPARTMENT: DEPARTMENT || "",
            FUNCTION: FUNCTION || "",
            BALANCE: BALANCE || 0,
            STREET: STREET || "",
            POSTALCODE: POSTALCODE || "",
            CITY: CITY || "",
            REGION: REGION || "",
            STATE: STATE || "",
            COUNTRY: COUNTRY || "",
            ROLES: ROLES || [],
            DETAIL_ROW: {
              ACTIVED: true,
              DELETED: false,
              DETAIL_ROW_REG: detailRowReg,
            },
          };

          const result = await mongoose.connection
            .collection("ZTUSERS")
            .insertOne(newUser);

          return {
            message: "Usuario creado exitosamente",
            user: newUser,
          };
        } catch (error) {
          console.error("Error al crear el usuario:", error.message);
          throw error;
        }
      case "update":
        try {
          const { userid, roleid } = req?.req?.query;
          const { users } = req?.req?.body;

          if (!userid || !users || typeof users !== "object") {
            return {
              error: true,
              message: "Faltan datos requeridos: USERID o body inválido.",
            };
          }

          // Verifica si se va a modificar un rol existente
          if (roleid && users?.ROLES?.[0]?.ROLEID) {
            const newRoleId = users.ROLES[0].ROLEID;

            // Verificar si el nuevo rol ya está asignado
            const userData = await mongoose.connection
              .collection("ZTUSERS")
              .findOne({ USERID: userid });
            if (!userData) {
              return {
                error: true,
                message: `No se encontró el usuario '${userid}'.`,
              };
            }

            const alreadyHasNewRole = userData.ROLES?.some(
              (r) => r.ROLEID === newRoleId
            );
            if (alreadyHasNewRole) {
              return {
                error: true,
                message: `El usuario ya tiene asignado el ROLEID '${newRoleId}'.`,
              };
            }

            const hasOldRole = userData.ROLES?.some((r) => r.ROLEID === roleid);
            if (!hasOldRole) {
              return {
                error: true,
                message: `El usuario no tiene el ROLEID '${roleid}' asignado.`,
              };
            }

            // Verifica si el nuevo ROLEID existe
            const newRoleData = await mongoose.connection
              .collection("ZTROLES")
              .findOne({ ROLEID: newRoleId });
            if (!newRoleData) {
              return {
                error: true,
                message: `El nuevo ROLEID '${newRoleId}' no existe en ZTROLES.`,
              };
            }

            // Actualiza el rol en la posición correspondiente
            await mongoose.connection.collection("ZTUSERS").updateOne(
              {
                USERID: userid,
                "ROLES.ROLEID": roleid,
              },
              {
                $set: {
                  "ROLES.$.ROLEID": newRoleId,
                },
              }
            );
          }

          // Prepara campos adicionales a actualizar (sin ROLES)
          const { ROLES, ...otherFields } = users;

          // Actualiza los otros campos si hay alguno
          if (Object.keys(otherFields).length > 0) {
            await mongoose.connection
              .collection("ZTUSERS")
              .updateOne({ USERID: userid }, { $set: otherFields });
          }

          // Si se recibe un array ROLES, reemplazarlo completamente
          if (Array.isArray(users.ROLES)) {
            await mongoose.connection
              .collection("ZTUSERS")
              .updateOne(
                { USERID: userid },
                { $set: { ROLES: users.ROLES } }
              );
          }

          // Si no se especificó roleid pero sí se quiere agregar uno nuevo
          if (!roleid && users?.ROLES?.[0]?.ROLEID) {
            const newRoleId = users.ROLES[0].ROLEID;

            const newRoleData = await mongoose.connection
              .collection("ZTROLES")
              .findOne({ ROLEID: newRoleId });
            if (!newRoleData) {
              return {
                error: true,
                message: `El ROLEID '${newRoleId}' no existe en ZTROLES.`,
              };
            }
            

            const userData = await mongoose.connection
              .collection("ZTUSERS")
              .findOne({ USERID: userid });
            const alreadyHasRole = userData?.ROLES?.some(
              (r) => r.ROLEID === newRoleId
            );
            if (alreadyHasRole) {
              return {
                error: true,
                message: `El usuario ya tiene asignado el ROLEID '${newRoleId}'.`,
              };
            }

            // Si se recibe un array ROLES, reemplazarlo completamente
            if (Array.isArray(users.ROLES)) {
              await mongoose.connection
                .collection("ZTUSERS")
                .updateOne(
                  { USERID: userid },
                  { $set: { ROLES: users.ROLES } }
                );
            }
          }

          return {
            message: `El usuario '${userid}' fue actualizado correctamente.`,
          };
        } catch (error) {
          throw new Error(error.message);
        }
      default:
        throw new Error(
          "Acción no válida. Las acciones permitidas son: get, create y update."
        );
    }
  } catch (error) {
    console.error("Error en CrudUsers:", error.message);
    throw new Error(error.message);
  }
}

async function DeleteRecord(req) {
  try {
    // Extraer los parámetros de la request
    const { roleid, valueid, labelid, userid, borrado } = req?.req?.query;

    // Validación: al menos un ID debe estar presente
    if (!labelid && !userid && !roleid && !valueid) {
      throw new Error("Se debe proporcionar al menos un ID para eliminar");
    }

    console.log("Intentando eliminar:", {
      userid,
      roleid,
      labelid,
      valueid,
      borrado,
    });

    // Función genérica para simular eliminación (actualización de flags)
    const deleteFromCollection = async (collection, fieldName, value) => {
      const filter = { [fieldName]: value };
 
      const existingDoc = await mongoose.connection
        .collection(collection)
        .findOne(filter);

      if (!existingDoc) {
        throw new Error(
          `No se encontró el registro en la colección ${collection}`
        );
      }

      const deletedStatus = existingDoc.DETAIL_ROW?.DELETED;
      const activeStatus = existingDoc.DETAIL_ROW?.ACTIVED;


     // Construimos el registro de auditoría
      const regEntry = {
        CURRENT: true,
        REGDATE: new Date(),
        REGTIME: new Date(),
        REGUSER: "USER_TEST",        
      };

      if (borrado === "fisic") {
        // Borrado físico
        const result = await mongoose.connection
          .collection(collection)
          .deleteOne(filter);
        if (result.deletedCount === 0) {
          throw new Error(
            `No se pudo eliminar físicamente el registro en ${collection}`
          );
        }
        return { message: `Registro eliminado físicamente de ${collection}` };
      } else if (borrado === "activar") {
      // Reactivar el registro
      const result = await mongoose.connection
        .collection(collection)
        .updateOne(
          filter,
          {
            $set: {
              "DETAIL_ROW.ACTIVED": true,
              "DETAIL_ROW.DELETED": false
            },
            $push: {
              "DETAIL_ROW.DETAIL_ROW_REG": regEntry
            }
          }
        );
      if (result.modifiedCount === 0) {
        throw new Error(
          `No se pudo activar el registro en la colección ${collection}`
        );
      }
      return {
        message: `Registro activado correctamente en ${collection}`
      };
    } else {
              // Verificación de estado previo para evitar eliminar nuevamente
      if (
        deletedStatus === true &&
        activeStatus === false
      ) {
        throw new Error(
          `El registro en la colección ${collection} ya fue eliminado lógicamente anteriormente`
        );
      }

        await mongoose.connection
        .collection(collection)
        .updateOne(
          filter,
          {
            $set: {
              "DETAIL_ROW.DETAIL_ROW_REG.$[].CURRENT": false
            }
          }
        );
        const result = await mongoose.connection
          .collection(collection)
          .updateOne(
            filter,
            {
              $set: {
                "DETAIL_ROW.ACTIVED": false,
                "DETAIL_ROW.DELETED": true
              },
              $push: {
                "DETAIL_ROW.DETAIL_ROW_REG": regEntry
              }
            }
          );
        if (result.modifiedCount === 0) {
          throw new Error(
            `No se pudo actualizar el registro en la colección ${collection}`
          );
        }
        return {
          message: `Registro marcado como eliminado lógicamente en ${collection}`
        };
      }
    };

    // Verificar y aplicar eliminación
    if (labelid)
      return await deleteFromCollection("ZTLABELS", "LABELID", labelid);
    if (userid) return await deleteFromCollection("ZTUSERS", "USERID", userid);
    if (roleid) return await deleteFromCollection("ZTROLES", "ROLEID", roleid);
    if (valueid)
      return await deleteFromCollection("ZTVALUES", "VALUEID", valueid);
  } catch (error) {
    console.error("Error al eliminar el registro:", error.message);
    throw {
      code: 400,
      message: error.message,
      "@Common.numericSeverity": 4,
    };
  }
}

async function CrudValues(req) {
  try {
    const action = req.req.query.action;

    if (!action) {
      throw new Error("El parámetro 'action' es obligatorio.");
    }

    switch (action) {
      case "get":
        try {
          const labelid = req?.req?.query?.labelid;
          const valueid = req?.req?.query?.valueid;

          let result;

          if (!labelid && !valueid) {
            // Caso 1: No hay labelid ni valueid
            result = await mongoose.connection
              .collection("ZTVALUES") // ✅ Cambiado a la colección correcta
              .aggregate([
                {
                  $match: {
                    "DETAIL_ROW.ACTIVED": true, // Filtra los valores activos
                  },
                },
              ])
              .toArray();
          } else if (labelid && !valueid) {
            // Caso 2: Filtrar por LABELID -> Traer solo los registros con ese LABELID
            result = await mongoose.connection
              .collection("ZTVALUES")
              .aggregate([
                {
                  $match: {
                    LABELID: labelid,
                    "DETAIL_ROW.ACTIVED": true, // Solo traer registros activos
                  },
                },
              ])
              .toArray();

          } else if (labelid && valueid) {
            // Caso 3: Hay labelid y valueid
            result = await mongoose.connection
              .collection("ZTLABELS")
              .aggregate([
                {
                  $match: { LABELID: labelid },
                },
                {
                  $lookup: {
                    from: "ZTVALUES",
                    localField: "LABELID",
                    foreignField: "LABELID",
                    as: "VALUES",
                  },
                },
                {
                  $addFields: {
                    VALUES: {
                      $filter: {
                        input: "$VALUES",
                        as: "val",
                        cond: {
                          $and: [
                            { $eq: ["$$val.VALUEID", valueid] },
                            { $eq: ["$$val.DETAIL_ROW.ACTIVED", true] },
                          ],
                        },
                      },
                    },
                  },
                },
              ])
              .toArray();
          }

          return result;
        } catch (error) {
          console.error("Error en la agregación con $lookup:", error.message);
          throw error;
        }

      case "create":
        try {
          console.log("Datos recibidos por el backend:", JSON.stringify(req?.req?.body, null, 2));
          const {
            COMPANYID,
            CEDIID,
            LABELID,
            VALUEPAID,
            VALUEID,
            VALUE,
            ALIAS,
            SEQUENCE,
            IMAGE,
            VALUESAPID,
            DESCRIPTION,
            ROUTE,
            ACTIVED = true,
            DELETED = false,
            reguser,
          } = req?.req?.body?.values;
  //    case "create":
  // try {
    const valuesArray = req?.req?.body?.values;
    const currentDate = new Date();

    if (!Array.isArray(valuesArray) || valuesArray.length === 0) {
      throw new Error("Se debe proporcionar un arreglo de valores en 'values'.");
    }

    const validLabels = [
      "IdApplications",
      "IdViews",
      "IdProcesses",
      "IdRoles",
      "IdPrivileges",
    ];

    const newZTValues = [];

    for (const valueObj of valuesArray) {
      const {
        COMPANYID,
        CEDIID,
        LABELID,
        VALUEPAID,
        VALUEID,
        VALUE,
        ALIAS,
        SEQUENCE,
        IMAGE,
        VALUESAPID,
        DESCRIPTION,
        ROUTE,
        ACTIVED = true,
        DELETED = false,
        reguser,
      } = valueObj;

      if (!validLabels.includes(LABELID)) {
        throw new Error(
          `LABELID "${LABELID}" debe ser uno de los siguientes: ${validLabels.join(", ")}`
        );
      }

      const valueExists = await mongoose.connection
        .collection("ZTVALUES")
        .findOne({ VALUEID });

      if (valueExists) {
        throw new Error(`Ya existe un registro con VALUEID "${VALUEID}".`);
      }

      if (LABELID === "IdApplications" && VALUEPAID) {
        throw new Error(
          "VALUEPAID debe estar vacío cuando LABELID es IdApplications, ya que no tiene padre."
        );
      }

      if (LABELID !== "IdApplications") {
        const labelIndex = validLabels.indexOf(LABELID);
        const parentLabel = validLabels[labelIndex - 1];

        const regex = new RegExp(`^${parentLabel}-[A-Za-z0-9]+$`);
        if (!regex.test(VALUEPAID)) {
          throw new Error(
            `VALUEPAID debe seguir el formato "${parentLabel}-<IdRegistro>" sin espacios.`
          );
        }

        const parentId = VALUEPAID.split("-")[1];
        const parentExists = await mongoose.connection
          .collection("ZTVALUES")
          .findOne({ LABELID: parentLabel, VALUEID: parentId });

        if (!parentExists) {
          throw new Error(
            `El ID padre especificado (${parentId}) no existe como ${parentLabel}.`
          );
        }
      }

      const detailRowReg = [
        {
          CURRENT: false,
          REGDATE: currentDate,
          REGTIME: currentDate,
          REGUSER: reguser,
        },
        {
          CURRENT: true,
          REGDATE: currentDate,
          REGTIME: currentDate,
          REGUSER: reguser,
        },
      ];

      newZTValues.push({
        COMPANYID,
        CEDIID,
        LABELID,
        VALUEPAID: VALUEPAID || "",
        VALUEID,
        VALUE,
        ALIAS: ALIAS || "",
        SEQUENCE: SEQUENCE || 0,
        IMAGE: IMAGE || "",
        VALUESAPID: VALUESAPID || "",
        DESCRIPTION: DESCRIPTION || "",
        ROUTE: ROUTE || "",
        DETAIL_ROW: {
          ACTIVED,
          DELETED,
          DETAIL_ROW_REG: detailRowReg,
        },
      });
    }

    const result = await mongoose.connection
      .collection("ZTVALUES")
      .insertMany(newZTValues);

    return {
      message: "ZTValues creados exitosamente",
      insertedCount: result.insertedCount,
      insertedIds: result.insertedIds,
    };
  } catch (error) {
    throw new Error(error.message);
  }


      case "update":
        try {
          // Obtener VALUEID desde los query parameters
          const { valueid } = req?.req?.query;

          if (!valueid) {
            throw new Error(
              "El parámetro VALUEID es obligatorio para realizar la actualización."
            );
          }

          // Desestructuración de las propiedades del body
          const {
            COMPANYID,
            CEDIID,
            LABELID,
            VALUEPAID,
            VALUE,
            ALIAS,
            SEQUENCE,
            IMAGE,
            VALUESAPID,
            DESCRIPTION,
            ROUTE,
            ACTIVED,
            DELETED,
            reguser,
          } = req?.req?.body?.values || {};

          const currentDate = new Date();

          // Consultar el registro actual basado en VALUEID
          const existingRecord = await mongoose.connection
            .collection("ZTVALUES")
            .findOne({ VALUEID: valueid });

          if (!existingRecord) {
            throw new Error(
              `No se encontró un registro con el VALUEID: ${valueid}`
            );
          }

          // Obtener LABELID actual del registro si no se proporciona en el body
          const currentLabelId = LABELID || existingRecord.LABELID;

          // Validaciones (similar a CreateValue)
          const validLabels = [
            "IdApplications",
            "IdViews",
            "IdProcesses",
            "IdRoles",
            "IdPrivileges",
          ];

          if (!validLabels.includes(currentLabelId)) {
            throw new Error(
              `LABELID debe ser uno de los siguientes: ${validLabels.join(
                ", "
              )}`
            );
          }

          if (currentLabelId === "IdApplications" && VALUEPAID) {
            throw new Error(
              "VALUEPAID debe estar vacío cuando LABELID es IdApplications, ya que no tiene padre."
            );
          }

          if (currentLabelId !== "IdApplications" && VALUEPAID) {
            const labelIndex = validLabels.indexOf(currentLabelId);
            const parentLabel = validLabels[labelIndex - 1]; // El padre del LABELID actual

            // Verificar el formato de VALUEPAID (sin espacios alrededor del guion)
            const regex = new RegExp(`^${parentLabel}-[A-Za-z0-9]+$`);
            if (!regex.test(VALUEPAID)) {
              throw new Error(
                `VALUEPAID debe estar en el formato "${parentLabel}-<IdRegistro>" sin espacios alrededor del guion.`
              );
            }

            // Verificar la existencia del ID padre en la colección
            const parentId = VALUEPAID.split("-")[1];
            const parentExists = await mongoose.connection
              .collection("ZTVALUES")
              .findOne({ LABELID: parentLabel, VALUEID: parentId });

            if (!parentExists) {
              throw new Error(
                `El ID padre especificado (${parentId}) no existe en la colección ZTVALUES como ${parentLabel}.`
              );
            }
          }

          // Construcción dinámica del objeto de actualización
          const updateFields = {};
          if (COMPANYID) updateFields.COMPANYID = COMPANYID;
          if (CEDIID) updateFields.CEDIID = CEDIID;
          if (LABELID) updateFields.LABELID = LABELID;
          if (VALUEPAID) updateFields.VALUEPAID = VALUEPAID;
          if (VALUE) updateFields.VALUE = VALUE;
          if (ALIAS) updateFields.ALIAS = ALIAS;
          if (SEQUENCE !== undefined) updateFields.SEQUENCE = SEQUENCE;
          if (IMAGE) updateFields.IMAGE = IMAGE;
          if (VALUESAPID) updateFields.VALUESAPID = VALUESAPID;
          if (DESCRIPTION) updateFields.DESCRIPTION = DESCRIPTION;
          if (ROUTE) updateFields.ROUTE = ROUTE;
          if (ACTIVED !== undefined)
            updateFields["DETAIL_ROW.ACTIVED"] = ACTIVED;
          if (DELETED !== undefined)
            updateFields["DETAIL_ROW.DELETED"] = DELETED;

          updateFields["DETAIL_ROW_REG"] = [
            {
              CURRENT: false,
              REGDATE: currentDate,
              REGTIME: currentDate,
              REGUSER: reguser || "",
            },
            {
              CURRENT: true,
              REGDATE: currentDate,
              REGTIME: currentDate,
              REGUSER: reguser || "",
            },
          ];

          // Realizar la actualización en la colección
          const result = await mongoose.connection
            .collection("ZTVALUES")
            .updateOne({ VALUEID: valueid }, { $set: updateFields });

          if (result.modifiedCount === 0) {
            throw new Error(
              "No se encontró el registro con el VALUEID proporcionado o no se realizó la actualización."
            );
          }

          return {
            message: "ZTValue actualizado exitosamente",
            updatedFields: updateFields,
          };
        } catch (error) {
          throw new Error(error.message);
        }
      default:
        throw new Error(
          "Acción no válida. Las acciones permitidas son: create y update."
        );
    }
  } catch (error) {
    console.error("Error en CrudValues:", error.message);
    throw new Error(error.message);
  }
}

async function CrudRoles(req) {
  try {
    const action = req.req.query.action;
    const roleid = req.req.query?.roleid;

    if (!action) {
      throw new Error("El parámetro 'action' es obligatorio.");
    }

    switch (action) {
      case "create":
        try {
          const {
            ROLEID,
            ROLENAME,
            DESCRIPTION,
            PRIVILEGES,
            ACTIVED = true,
            DELETED = false,
            reguser,
          } = req.data.roles;

          if (!ROLEID || !ROLENAME || !Array.isArray(PRIVILEGES)) {
            return req.error(400, "Datos incompletos o inválidos");
          }

          const exists = await mongoose.connection
            .collection("ZTROLES")
            .findOne({ ROLEID });

          if (exists) {
            throw new Error(`Ya existe un rol con el ID ${ROLEID}`);
          }

          const currentDate = new Date();

          // Sección para DETAIL_ROW_REG
          const detailRow = [
            {
              CURRENT: false,
              REGDATE: currentDate,
              REGTIME: currentDate,
              REGUSER: reguser,
            },
            {
              CURRENT: true,
              REGDATE: currentDate,
              REGTIME: currentDate,
              REGUSER: reguser,
            },
          ];
          const newRole = {
            ROLEID,
            ROLENAME,
            DESCRIPTION: DESCRIPTION || "",
            PRIVILEGES,
            DETAIL_ROW: {
              ACTIVED,
              DELETED,
              DETAIL_ROW_REG: detailRow,
            },
          };
          await mongoose.connection.collection("ZTROLES").insertOne(newRole);
          return { message: "Rol creado exitosamente", role: newRole };
        } catch (error) {
          throw new Error(error.message);
        }
      case "update":
        try {
          const { roleid } = req?.req?.query;
          const { ROLENAME, DESCRIPTION, PRIVILEGES } = req.data.roles;

          if (!roleid) {
            throw new Error(
              "El parámetro ROLEID en query es obligatorio para actualizar"
            );
          }

          const collection = mongoose.connection.collection("ZTROLES");

          const exists = await collection.findOne({ ROLEID: roleid });

          if (!exists) {
            return req.error(404, `No se encontró un rol con el ID ${roleid}`);
          }

          const updatedFields = {};

          if (ROLENAME) updatedFields.ROLENAME = ROLENAME;
          if (DESCRIPTION) updatedFields.DESCRIPTION = DESCRIPTION;
          if (Array.isArray(PRIVILEGES)) updatedFields.PRIVILEGES = PRIVILEGES;

          if (Object.keys(updatedFields).length === 0) {
            throw new Error(
              "No se proporcionaron campos válidos para actualizar"
            );
          }

          await collection.updateOne(
            { ROLEID: roleid },
            { $set: updatedFields }
          );

          const updatedRole = await collection.findOne({ ROLEID: roleid });

          return {
            message: "Rol actualizado exitosamente",
            role: updatedRole,
          };
        } catch (error) {
          throw new Error(error.message);
        }

      case "get":
        try {
          const { roleid } = req?.req?.query;

          const pipeline = [];

          // Filtro por ROLEID si se especifica
          if (roleid) {
            pipeline.push({ $match: { ROLEID: roleid } });
          }

          // Filtrar los que estén activos
          pipeline.push({ $match: { "DETAIL_ROW.ACTIVED": true } });

          pipeline.push(
            { $unwind: "$PRIVILEGES" },
            {
              $lookup: {
                from: "ZTVALUES",
                let: { processId: "$PRIVILEGES.PROCESSID" },
                pipeline: [
                  {
                    $match: {
                      $expr: {
                        $eq: [
                          { $concat: ["IdProcess-", "$VALUEID"] },
                          "$$processId",
                        ],
                      },
                    },
                  },
                  {
                    $lookup: {
                      from: "ZTVALUES",
                      let: { viewId: "$VALUEPAID" },
                      pipeline: [
                        {
                          $match: {
                            $expr: {
                              $eq: [
                                { $concat: ["IdViews-", "$VALUEID"] },
                                "$$viewId",
                              ],
                            },
                          },
                        },
                        {
                          $lookup: {
                            from: "ZTVALUES",
                            let: { appId: "$VALUEPAID" },
                            pipeline: [
                              {
                                $match: {
                                  $expr: {
                                    $eq: [
                                      {
                                        $concat: [
                                          "IdApplications-",
                                          "$VALUEID",
                                        ],
                                      },
                                      "$$appId",
                                    ],
                                  },
                                },
                              },
                            ],
                            as: "applicationDetails",
                          },
                        },
                        {
                          $addFields: {
                            applicationInfo: {
                              $arrayElemAt: ["$applicationDetails", 0],
                            },
                          },
                        },
                      ],
                      as: "viewDetails",
                    },
                  },
                  {
                    $addFields: {
                      viewInfo: { $arrayElemAt: ["$viewDetails", 0] },
                    },
                  },
                ],
                as: "processDetails",
              },
            },
            {
              $addFields: {
                processInfo: { $arrayElemAt: ["$processDetails", 0] },
              },
            },
            {
              $group: {
                _id: "$ROLEID",
                ROLEID: { $first: "$ROLEID" },
                ROLENAME: { $first: "$ROLENAME" },
                DESCRIPTION: { $first: "$DESCRIPTION" },
                PROCESSES: {
                  $push: {
                    PROCESSID: "$PRIVILEGES.PROCESSID",
                    PROCESSNAME: "$processInfo.VALUE",
                    VIEWID: "$processInfo.viewInfo.VALUEID",
                    VIEWNAME: "$processInfo.viewInfo.VALUE",
                    APPLICATIONID:
                      "$processInfo.viewInfo.applicationInfo.VALUEID",
                    APPLICATIONNAME:
                      "$processInfo.viewInfo.applicationInfo.VALUE",
                    PRIVILEGES: {
                      $map: {
                        input: "$PRIVILEGES.PRIVILEGEID",
                        as: "privId",
                        in: {
                          PRIVILEGEID: "$$privId",
                          PRIVILEGENAME: "$$privId",
                        },
                      },
                    },
                  },
                },
                DETAIL_ROW: { $first: "$DETAIL_ROW" },
              },
            },
            {
              $project: {
                _id: 0,
                ROLEID: 1,
                ROLENAME: 1,
                DESCRIPTION: 1,
                PROCESSES: 1,
                DETAIL_ROW: 1,
              },
            }
          );

          const result = await mongoose.connection
            .collection("ZTROLES")
            .aggregate(pipeline)
            .toArray();

          return result;
        } catch (error) {
          throw new Error(error.message);
        }

      // Servicio para obtener usuarios con sus roles
      case "getUsByRo":
        try {
          const { roleid } = req.req.query;

          if (!roleid) {
            throw new Error("No se proporcinó el ID del usuario");
          }

          const pipeline = [
            { $unwind: "$ROLES" },
            ...(roleid ? [{ $match: { "ROLES.ROLEID": roleid } }] : []), // filtro dinámico
            {
              $lookup: {
                from: "ZTROLES",
                localField: "ROLES.ROLEID",
                foreignField: "ROLEID",
                as: "roleDetail",
              },
            },
            {
              $addFields: {
                roleInfo: {
                  ROLEID: "$ROLES.ROLEID",
                  ROLENAME: { $arrayElemAt: ["$roleDetail.ROLENAME", 0] },
                  DESCRIPTION: { $arrayElemAt: ["$roleDetail.DESCRIPTION", 0] },
                },
              },
            },
            {
              $group: {
                _id: "$_id",
                userData: { $first: "$$ROOT" },
                roles: { $push: "$roleInfo" },
              },
            },
            {
              $replaceRoot: {
                newRoot: {
                  $mergeObjects: ["$userData", { ROLES: "$roles" }],
                },
              },
            },
            {
              $project: {
                roleDetail: 0,
                roleInfo: 0,
                "userData.ROLES": 0,
              },
            },
          ];

          const result = await mongoose.connection
            .collection("ZTUSERS")
            .aggregate(pipeline)
            .toArray();

          return result;
        } catch (error) {
          throw new Error(error.message);
        }

      default:
        throw new Error(
          "Acción no válida. Las acciones permitidas son: create, update, getRoles y getUserRoles."
        );
    }
  } catch (error) {
    console.error("Error en CrudValues:", error.message);
    throw new Error(error.message);
  }
}

async function CrudLabels(req) {
  try {
    const action = req.req.query.action;

    if (!action) {
      throw new Error("El parámetro 'action' es obligatorio.");
    }

    switch (action) {
      case "get":
        try {
          const labelid = req?.req?.query?.labelid;

          let result;

          if (!labelid) {
            // Obtener todos los labels activos
            result = await mongoose.connection
              .collection("ZTLABELS")
              .aggregate([])
              .toArray();
          } else {
            // Obtener un label específico con sus datos
            result = await mongoose.connection
              .collection("ZTLABELS")
              .aggregate([
                {
                  $match: { LABELID: labelid },
                },
              ])
              .toArray();
          }

          return result;
        } catch (error) {
          console.error("Error en la agregación de labels:", error.message);
          throw error;
        }

      case "create":
        try {
          const {
            COMPANYID = 0,
            CEDIID = 0,
            LABELID,
            LABEL,
            INDEX,
            COLLECTION,
            SECTION,
            SEQUENCE,
            IMAGE,
            DESCRIPTION,
            DETAIL_ROW: [
              {
                ACTIVED,
                DELETED = false,
              }
            ],
            reguser,
          } = req?.req?.body?.labels;

          const currentDate = new Date();

          const detailRowReg = [
            {
              CURRENT: false,
              REGDATE: currentDate,
              REGTIME: currentDate,
              REGUSER: reguser,
            },
            {
              CURRENT: true,
              REGDATE: currentDate,
              REGTIME: currentDate,
              REGUSER: reguser,
            },
          ];

          const newZTLabel = {
            COMPANYID,
            CEDIID,
            LABELID: LABELID || "",
            LABEL: LABEL || "",
            INDEX: INDEX || "",
            COLLECTION: COLLECTION || "",
            SECTION: SECTION || "",
            SEQUENCE: SEQUENCE || 0,
            IMAGE: IMAGE || "",
            DESCRIPTION: DESCRIPTION || "",
            DETAIL_ROW: {
              ACTIVED,
              DELETED,
              DETAIL_ROW_REG: detailRowReg,
            },
          };

          const result = await mongoose.connection
            .collection("ZTLABELS")
            .insertOne(newZTLabel);

          return {
            message: "ZTLabel creado exitosamente",
            ztlabelId: newZTLabel,
          };
        } catch (error) {
          throw new Error(error.message);
        }

      case "update":
        try {
          const { labelid } = req?.req?.query;

          if (!labelid) {
            throw new Error(
              "El parámetro LABELID es obligatorio para realizar la actualización."
            );
          }

          const {
            COMPANYID,
            CEDIID,
            LABEL,
            INDEX,
            COLLECTION,
            SECTION,
            SEQUENCE,
            IMAGE,
            DESCRIPTION,
            ACTIVED,
            DELETED,
            reguser,
          } = req?.req?.body?.labels || {};

          const currentDate = new Date();

          const existingRecord = await mongoose.connection
            .collection("ZTLABELS")
            .findOne({ LABELID: labelid });

          if (!existingRecord) {
            throw new Error(
              `No se encontró un registro con el LABELID: ${labelid}`
            );
          }

          const updateFields = {};
          if (COMPANYID) updateFields.COMPANYID = COMPANYID;
          if (CEDIID) updateFields.CEDIID = CEDIID;
          if (LABEL) updateFields.LABEL = LABEL;
          if (INDEX) updateFields.INDEX = INDEX;
          if (COLLECTION) updateFields.COLLECTION = COLLECTION;
          if (SECTION) updateFields.SECTION = SECTION;
          if (SEQUENCE !== undefined) updateFields.SEQUENCE = SEQUENCE;
          if (IMAGE) updateFields.IMAGE = IMAGE;
          if (DESCRIPTION) updateFields.DESCRIPTION = DESCRIPTION;
          if (ACTIVED !== undefined)
            updateFields["DETAIL_ROW.ACTIVED"] = ACTIVED;
          if (DELETED !== undefined)
            updateFields["DETAIL_ROW.DELETED"] = DELETED;

          updateFields["DETAIL_ROW_REG"] = [
            {
              CURRENT: false,
              REGDATE: currentDate,
              REGTIME: currentDate,
              REGUSER: reguser || "",
            },
            {
              CURRENT: true,
              REGDATE: currentDate,
              REGTIME: currentDate,
              REGUSER: reguser || "",
            },
          ];

          const result = await mongoose.connection
            .collection("ZTLABELS")
            .updateOne({ LABELID: labelid }, { $set: updateFields });

          if (result.modifiedCount === 0) {
            throw new Error(
              "No se encontró el registro con el LABELID proporcionado o no se realizó la actualización."
            );
          }

          return {
            message: "ZTLabel actualizado exitosamente",
            updatedFields: updateFields,
          };
        } catch (error) {
          throw new Error(error.message);
        }

      default:
        throw new Error(
          "Acción no válida. Las acciones permitidas son: get, create y update."
        );
    }
  } catch (error) {
    console.error("Error en CrudLabels:", error.message);
    throw new Error(error.message);
  }
}

module.exports = {
  DeleteRecord,
  CrudUsers,
  CrudValues,
  CrudRoles,
  CrudLabels,
};
