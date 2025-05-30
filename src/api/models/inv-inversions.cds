namespace inv;


type StrategyRule : {
    INDICATOR : String;
    PERIOD    : Integer;
    CONDITION : String;
    ACTION    : String;
};

entity SIMULATION {
    key SIMULATIONID   : String;
        USERID         : String;
        STRATEGYID     : String;
        SIMULATIONNAME : String;
        SYMBOL         : String;
        STARTDATE      : Date;
        ENDDATE        : Date;
        AMOUNT         : Decimal(10, 2);
        SPECS          : array of INDICATOR;
        SIGNALS        : array of SIGNAL;
        SUMMARY        : SUMMARY; // OBJETO DE RESUMEN
        CHART_DATA     : array of CHARTDATA; // DATOS PARA EL GRÁFICO
        DETAIL_ROW     : array of DETAILROW; // DETALLES DE REGISTRO
}

// TIPO PARA LAS SEÑALES DE COMPRA/VENTA
type SIGNAL {
    DATE      : Date; // FORMATO "YYYY-MM-DD"
    TYPE      : String;
    PRICE     : Decimal(10, 2);
    REASONING : String;
    SHARES    : Decimal(18, 15); // ALTA PRECISIÓN
}

// TIPO PARA EL OBJETO DE RESUMEN
type SUMMARY {
    TOTAL_BOUGHT_UNITS : Decimal(18, 4);
    TOTAL_SOLD_UNITS   : Decimal(18, 4);
    REMAINING_UNITS    : Decimal(18, 4);
    FINAL_CASH         : Decimal(10, 2);
    FINAL_VALUE        : Decimal(10, 2);
    FINAL_BALANCE      : Decimal(10, 2);
    REAL_PROFIT        : Decimal(10, 2);
    PERCENTAGE_RETURN  : Decimal(18, 15); // ALTA PRECISIÓN
}

// TIPO PARA LOS DATOS DEL GRÁFICO
type CHARTDATA {
    DATE       : DateTime; // FORMATO ISO 8601
    OPEN       : Decimal(10, 2);
    HIGH       : Decimal(10, 2);
    LOW        : Decimal(10, 2);
    CLOSE      : Decimal(10, 2);
    VOLUME     : Integer;
    INDICATORS : array of INDICATOR; // ARRAY DE INDICADORES
}

// TIPO PARA LOS INDICADORES DENTRO DE CHARTDATA
type INDICATOR {
    INDICATOR : String;
    VALUE     : Decimal(18, 15); // ALTA PRECISIÓN
}

// TIPO PARA EL DETALLE DE LA FILA (DETAIL_ROW)
type DETAILROW {
    ACTIVED        : Boolean;
    DELETED        : Boolean;
    DETAIL_ROW_REG : array of DETAILROWREG;
}

// TIPO PARA LOS REGISTROS DENTRO DE DETAIL_ROW_REG
type DETAILROWREG {
    CURRENT : Boolean;
    REGDATE : DateTime;
    REGTIME : String; // "HH:MM:SS"
    REGUSER : String;
}

entity strategies {
    key ID          : String;
        NAME        : String;
        DESCRIPTION : String;
        RULES       : array of StrategyRule;
        DETAIL_ROW  : array of DETAILROW; // DETALLES DE REGISTRO
}

entity company {
    key SYMBOL                 : String;
        NAME                   : String;
        SECTOR                 : String;
        INDUSTRY               : String;
        DESCRIPTION            : String;
        COUNTRY                : String;
        CURRENCY               : String;
        ADDRESS                : String;
        ASSET_TYPE             : String;
        MARKET_CAP             : Decimal(20, 0);
        EPS                    : Decimal(10, 4);
        PE_RATIO               : Decimal(10, 4);
        PEG_RATIO              : Decimal(10, 4);
        DIVIDEND_YIELD         : Decimal(10, 4);
        DIVIDEND_PER_SHARE     : Decimal(10, 4);
        EX_DIVIDEND_DATE       : Date;
        DIVIDEND_DATE          : Date;
        FISCAL_YEAR_END        : String;
        BOOK_VALUE             : Decimal(10, 4);
        BETA                   : Decimal(10, 4);
        PROFIT_MARGIN          : Decimal(10, 4);
        OPERATING_MARGIN_TTM   : Decimal(10, 4);
        RETURN_ON_ASSETS_TTM   : Decimal(10, 4);
        RETURN_ON_EQUITY_TTM   : Decimal(10, 4);
        REVENUE_TTM            : Decimal(20, 0);
        GROSS_PROFIT_TTM       : Decimal(20, 0);
        REVENUE_PER_SHARE_TTM  : Decimal(10, 4);
        SHARES_OUTSTANDING     : Decimal(20, 0);
        EBITDA                 : Decimal(20, 0);
        LATEST_QUARTER         : Date;
        TRAILING_PE            : Decimal(10, 4);
        FORWARD_PE             : Decimal(10, 4);
        PRICE_TO_BOOK          : Decimal(10, 4);
        PRICE_TO_SALES_TTM     : Decimal(10, 4);
        QUARTERLY_EARNINGS_YOY : Decimal(10, 4);
        QUARTERLY_REVENUE_YOY  : Decimal(10, 4);
        ANALYST_TARGET_PRICE   : Decimal(10, 2);
        ANALYST_BUY            : Integer;
        ANALYST_HOLD           : Integer;
        ANALYST_SELL           : Integer;
        ANALYST_STRONG_BUY     : Integer;
        ANALYST_STRONG_SELL    : Integer;
        MOVING_AVERAGE_50D     : Decimal(10, 2);
        MOVING_AVERAGE_200D    : Decimal(10, 2);
        WEEK_52_HIGH           : Decimal(10, 2);
        WEEK_52_LOW            : Decimal(10, 2);
        OFFICIAL_SITE          : String;
}

entity Indicators {
    SYMBOL    : String;
    INDICATOR : String;
    INTERVAL  : String;
    TIMEZONE  : String;
    DATA      : array of {
        DATE  : String;
        VALUE : String;
    };
}
