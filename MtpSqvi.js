/**************************************
多交易对现货长线量化价值投资策略V2.6.2
说明：
1.本策略使用与行情无关，只与价格相关的设计思想，脱离技术指标不作任何预测，实现长线价值投资。
2.本策略重在稳定长期盈利，保持胜率100%是原则，为投资带来稳定的较高的回报。
3.在保持长线策略的同时增加了短线交易操作、低位保仓和日线金叉保仓操作、超跌超底操作，使得收盈能力大大提升。
4.严控保仓风险，控制保仓比例的严格执行，防止贪婪带来风险。
5.为了实现商业化增加托管服务能力功能，为托管服务的开展提供基础保障

支持多个交易对，参数通过JSON传递过来
Json	策略参数JSON内容	JSON内容为以下多个交易对的数组JSON	字符串型(string)

单个交易对的策略参数如下
参数	描述	类型	默认值
TradePairName	交易对名称	用于显示和保存数据	字符串型(string)	
MaxCoinLimit	最大持仓量	最大持仓量将不能被突破 数字型(number)	1200
MinCoinLimit	最小持仓量	最小持仓量将一直保持	数字型(number)	600
OperateFineness	买卖操作的粒度	初始交易对的交易操作粒度	数字型(number)	100
NowCoinPrice	当前持仓平均价格/指导买入价格	数字型(number)	0
BuyFee	平台买入手续费	用于准确计算收益	数字型(number)	0.002
SellFee	平台卖出手续费	用于准确计算收益		数字型(number)	0.002
PriceDecimalPlace	交易对价格小数位	用于确定交易平台交易对价格小数位	数字型(number)	2 
StockDecimalPlace	交易对数量小数位	用于确定交易平台交易对数量小数位	数字型(number)	4 
BuyPoint 基准买入点	是数值不是百分比	数字型(number)	0.05
AddPointInBuy 买入点动态增加值	是数值不是百分比	数字型(number)	0.008
SellPoint 基准卖出点	是数值不是百分比	数字型(number)	0.05
AddPointInSell 卖出点动态增加值	是数值不是百分比	数字型(number)	0.008
CanKeepPosition 金叉保仓	是否允许交易对金叉时操作保仓	数字型(number)	1
HistoryHighPoint	半年历史高点	用于了解当前价格水平	数字型(number)	0.05
HistoryLowPoint 	半年历史低点	用于了解当前价格水平	数字型(number)	0.01
Debug	日志开关	回测时可以通过设为1打开指定交易对全部日志 数字型(number)	0
TradeLimits	交易限额	交易所对于交易对详细的限额数据对像{"LPOMinAmount": 0.001,
            "LPOMaxAmount": 1000,
            "MPOMinBuyAmount": 1,
            "MPOMaxBuyAmount": 1000000,
            "MPOMinSellAmount": 0.001,
            "MPOMaxSellAmount": 100}

策略交互如下
NewAvgPrice	更新持仓平均价格	更新当前持仓均价，用于手动操作买入之后的均价调整，填写格式：TradePairName|Price    字符串型(string) _|_
GuideBuyPrice	更新买入指导价格    更新买入指导价，调节买入卖出的相关点位，填写格式：TradePairName|Price	字符串型(string) _|_
LastBuyPrice	更新上次买入价格    更新调整上次买入价，不更新持仓均价，用于影响调节下一次买入点，填写格式：TradePairName|Price	字符串型(string) _|_
LastSellPrice	更新上次卖出价格    更新调整上次卖出价，用于影响调节下一次卖出点，填写格式：TradePairName|Price	字符串型(string) _|_
NewBuyPoint	更新动态买入点	根据行情的变化调整动态买入点，是数值不是百分比，填写格式：TradePairName/ALL|小于1的数值	字符串型(string) _|_
NewSellPoint	更新动态卖出点	根据行情的变化调整动态卖出点，是数值不是百分比，填写格式：TradePairName/ALL|小于1的数值	字符串型(string) _|_
NewOperateFineness 更新操作粒度	根据行情可以调整操作粒度，值的填写格式如下:TradePairName|OperateFineness	字符串型(string) _|_
SsstSwitch	短线交易开关	控制短线交易操作是否可以进行，状态为：0关闭，1打开，2为自动，值的填写格式如下:TradePairName(更新全部交易对用ALL)|0/1/2	字符串型(string) _|_
ManualOperation	MO操作	适用于账户终始化、结算平仓和紧急情况处理，值的填写格式如下:TradePairName|Type(0取消/1卖出/2买入)|Price/OrderID|Amount	字符串型(string) _|_|_|_
ConditionOperation 条件操作 当达到指定条件时，执行指定的策略互动操作。 值的填写格式如下:Condition(价格，交叉数)|策略互动命令|互动参数 字符串型(string) _|_|_
OperationLog	交易日志 把当前操作的原因和目的通过LOG功能输出到日志信息当中，方便日后回看。	字符串型(string) ALL|_
ClearLog 清除日志	手动清除当前策略的日志，值为需要保留的最近的记录条数 数字型(number) 0
Debug	更新调试状态	值的填写格式如下:TradePairName(更新全部交易对用ALL)|0/1 字符串型(string) ALL|0
************************************************/

//全局常数定义
//操作类型常量
var OPERATE_STATUS_NONE = -1;
var OPERATE_STATUS_BUY = 0; 
var OPERATE_STATUS_SELL = 1;
//三档挂单级别定义
var THRID_ORDERY_LEVELS = [0.02, 0.03, 0.04];
//定义建议交易深度
var Transaction_Depth = 30;

//全局变量定义
function TradePair(){
	this.Name = "";	//交易对名称,用于定量加前缀，格式如Huobi_LTC_BTC
	this.Title = "";	//交易对标题，用于表格显示，格式如Huobi/LTC_BTC
	this.Exchange = {};	//交易所对像exchange
	this.TPInfo = {};	//交易对当前信息
	this.Args = {};	//本交易对参数
	this.LastUpdate = {};	//最后更新时间
	this.Sssts = [];		//短线交易操作对像数组，装三层挂单
}
function SsstData(){
	this.Type = 0;	//交易类型，1为卖单，-1为买单
	this.Level = 0;	//档次，1%，3%，5%
	this.BuyPrice = 0;	//买入价
	this.Amount = 0;	//交易量
	this.SellPrice = 0;	//卖出价
	this.OrderID = 0;	//订单编号
	this.OrderTime = 0;	//持单时间戳
}
var TradePairs = [];	//所有交易对数组
var NowTradePairIndex = 0;		//当前的交易所对索引
var TotalProfit = 0;	//策略累计收益
var StartTime = _D();	//策略启动时间
var TickTimes = 0;		//刷新次数
var ArgTables;		//已经处理好的用于显示的参数表，当参数更新时置空重新生成，以加快刷新速度
var AccountTables;	//当前的账户信息表，如果当前已经有表，只要更新当前交易对，这样可以加快刷新速度，减少内存使用
var LastRecords = {"DayRecords":null,"HourRecords":null};
var DayLineCrossNum = 0;	//当前日线交叉数
var MOOrders = [];	//当前MO交易挂单
var TpMOOrders = [];	//当前交易对MO交易挂单详情


//取得交易所对像
function getExchange(name){
	var e;
	for(var i=0;i<exchanges.length;i++){
		var exchangeName = exchanges[i].GetName()+"_"+exchanges[i].GetCurrency();
		if(exchangeName == name){
			e = exchanges[i];
			break;
		}
	}
	return e;
}


//获取当前时间戳
function getTimestamp(){
	return new Date().getTime();
}

//验证JSON内容格式
function isJSON(str) {
	if (typeof str == 'object'){
		return true;
	}else if (typeof str == 'string') {
        try {
            var obj=JSON.parse(str);
            if(typeof obj == 'object' && obj ){
                return true;
            }else{
                return false;
            }

        } catch(e) {
            Log("不正确的JSON格式内容！请确认参数JSON内容是否正确！");
            return false;
        }
    }
}

//初始运行检测
function checkArgs(tp){
	var ret = true;
	var a = tp.Args;
	//检测参数的填写
	if(a.MaxCoinLimit === 0){
		Log(tp.Title,"交易对参数：最大持仓量为0，必须填写此字段。 #FF0000");
		ret = false;
	}
	if(a.OperateFineness === 0){
		Log(tp.Title,"交易对参数：基础买卖操作的粒度为0，必须填写此字段。 #FF0000");
		ret = false;
	}
	if(a.BuyFee === 0 || a.SellFee === 0){
		Log(tp.Title,"交易对参数：平台买卖手续费为0，必须填写此字段。 #FF0000");
		ret = false;
	}
	if(a.PriceDecimalPlace === 0){
		Log(tp.Title,"交易对参数：交易对价格小数位为0，必须填写此字段。 #FF0000");
		ret = false;
	}
	if(a.BuyPoint === 0){
		Log(tp.Title,"交易对参数：基准买入点为0，必须填写此字段。 #FF0000");
		ret = false;
	}
	if(a.SellPoint === 0){
		Log(tp.Title,"交易对参数：基准卖出点为0，必须填写此字段。 #FF0000");
		ret = false;
	}
	Log(tp.Title,"交易对接收参数如下：",tp.Args);
	return ret;
}

//解释参数JSON内容
function parseArgsJson(json){
	Log("准备解析传入的JSON参数...");
	var ret = false;
	if(isJSON(json)){
		Log("JSON格式检测通过...");
		var args = eval(json);
		if(args){
			Log("JSON转成JS对像成功，传入交易对参数有",args.length,"对...");
			for(var i=0;i<args.length;i++){
				var tp = new TradePair();
				tp.Name = args[i].ExchangeName+"_"+args[i].TradePairName;
				tp.Title = args[i].ExchangeName+"/"+args[i].TradePairName;
				var Args = {
					MaxCoinLimit:args[i].MaxCoinLimit,
					MinCoinLimit:args[i].MinCoinLimit,
					OperateFineness:args[i].OperateFineness,
					NowCoinPrice:args[i].NowCoinPrice,
					BuyFee:args[i].BuyFee,
					SellFee:args[i].SellFee,
					PriceDecimalPlace:args[i].PriceDecimalPlace,
					StockDecimalPlace:args[i].StockDecimalPlace,
					BuyPoint:args[i].BuyPoint,
					AddPointInBuy:args[i].AddPointInBuy,
					SellPoint:args[i].SellPoint,
					AddPointInSell:args[i].AddPointInSell,
					CanKeepPosition:args[i].CanKeepPosition,
					HistoryHighPoint:args[i].HistoryHighPoint,
					HistoryLowPoint:args[i].HistoryLowPoint,
					Debug:args[i].Debug,
					TradeLimits: args[i].TradeLimits
				};					
				tp.Args = Args;
				//检测参数的填写
				if(!checkArgs(tp)){
					continue;
				}
				tp.Exchange = getExchange(tp.Name);
				if(tp.Exchange){
					Log("匹配到交易对：",tp.Title);
					TradePairs.push(tp);
					//初始化其他参数
					if(!_G(tp.Name+"_BuyTimes")) _G(tp.Name+"_BuyTimes",0);
					if(!_G(tp.Name+"_SellTimes")) _G(tp.Name+"_SellTimes",0);
					if(!_G(tp.Name+"_SubProfit")) _G(tp.Name+"_SubProfit",0);
					if(!_G(tp.Name+"_LastOrderId")) _G(tp.Name+"_LastOrderId",0);
					if(!_G(tp.Name+"_OperatingStatus")) _G(tp.Name+"_OperatingStatus",OPERATE_STATUS_NONE);
					if(!_G(tp.Name+"_BeforeBuyingStocks")) _G(tp.Name+"_BeforeBuyingStocks",0);	//买入前的币数量
					if(!_G(tp.Name+"_AddTime")) _G(tp.Name+"_AddTime",_D());
					if(!_G(tp.Name+"_Ssst_CanDo")) _G(tp.Name+"_Ssst_CanDo",0);	//短线交易开关,值为：0关闭，1打开，2为自动
					if(!_G(tp.Name+"_Debug")) _G(tp.Name+"_Debug",Args.Debug);
					if(!_G(tp.Name+"_BuyGuidePrice")) _G(tp.Name+"_BuyGuidePrice",Args.NowCoinPrice);
					if(!_G(tp.Name+"_OperateFineness")) _G(tp.Name+"_OperateFineness",Args.OperateFineness);
					if(!_G(tp.Name+"_BuyDynamicPoint")) _G(tp.Name+"_BuyDynamicPoint",tp.Args.BuyPoint);	
					if(!_G(tp.Name+"_SellDynamicPoint")) _G(tp.Name+"_SellDynamicPoint",tp.Args.SellPoint);
				    if(!_G(tp.Name+"_LastBuyPrice")) _G(tp.Name+"_LastBuyPrice",0);
				    if(!_G(tp.Name+"_LastSellPrice")) _G(tp.Name+"_LastSellPrice",0);
					if(!_G(tp.Name+"_HistoryHighPoint")) _G(tp.Name+"_HistoryHighPoint",0);
					if(!_G(tp.Name+"_OverFallBuy")) _G(tp.Name+"_OverFallBuy",0);
					if(!_G(tp.Name+"_ViaGoldArea")) _G(tp.Name+"_ViaGoldArea",0);
					ret = true;
				}else{
					Log("未匹配交易对参数：",tp.Name,"请确认交易对的添加是否正确！");
				}
			}
		}
		Log("成功匹配到",TradePairs.length,"个交易对。");
	}
	return ret;
}
//初始化运行参数
function init(){
	//设置排除错误日志，以免错误日志过多把机器人硬盘写爆
	SetErrorFilter("500:|429:|403:|502:|503:|Forbidden|tcp|character|unexpected|network|timeout|WSARecv|Connect|GetAddr|no such|reset|http|received|EOF|reused");

	Log("启动多交易对现货长线量化价值投资策略程序...");  

	//初始化存储变量
	if(!_G("TotalProfit")) _G("TotalProfit",0);

	//解析JSON参数
	parseArgsJson(Json);

	//初始化Ssst对像
	for(var t=0;t<TradePairs.length;t++){
		var tp = TradePairs[t];
		if(_G(tp.Name+"_Ssst_CanDo")){
			for(var i=0;i<3;i++){
				var ssst = new SsstData();
				ssst.OrderID = _G(tp.Name+"_Ssst_OrderID"+i);
				if(ssst.OrderID){
					ssst.Type = _G(tp.Name+"_Ssst_Type"+i);
					ssst.Level = _G(tp.Name+"_Ssst_Level"+i);
					ssst.BuyPrice = _G(tp.Name+"_Ssst_BuyPrice"+i);
					ssst.Amount = _G(tp.Name+"_Ssst_Amount"+i);
					ssst.SellPrice = _G(tp.Name+"_Ssst_SellPrice"+i);
					ssst.OrderTime = _G(tp.Name+"_Ssst_OrderTime"+i);
					tp.Sssts.push(ssst);
				}
			}
		}
	}
	
	//初始化MO挂单
	var moorders = _G("MOOrders");
	if(moorders && moorders.length){
		MOOrders = moorders;
	}
}

//获取K线记录
function GetRecords(tp, klinetype) {
	var records = null;
	if(klinetype == PERIOD_D1){
		if(LastRecords.DayRecords){
			records = LastRecords.DayRecords;
		}else{
			records = _C(tp.Exchange.GetRecords, klinetype);
			LastRecords.DayRecords = records;
		}
	}else if(klinetype == PERIOD_H1){
		if(LastRecords.HourRecords){
			records = LastRecords.HourRecords;
		}else{
			records = _C(tp.Exchange.GetRecords, klinetype);
			LastRecords.HourRecords = records;
		}
	}else{
		records = _C(tp.Exchange.GetRecords, klinetype);
	}
	//如果是回测在前面追加30条记录
	//此方法可以让回测的时候前面21条K线有交叉数，但第一交叉到来之前的交叉数是不精确的，但大方向是对的
	//特别需要意的是在回测开始日期的一小段时间内如果震幅比较小可能会出现假正叉
	if(records.length<21){
		var data = records[0];
		if(data){
			for(var i=0;i<=21;i++){
				records.unshift(data);
			}
		}
	}
    return records;
}

//获取当前行情
function GetTicker(tp) {
    return _C(tp.Exchange.GetTicker);
}

//获取帐户信息
function GetAccount(tp) {
    return _C(tp.Exchange.GetAccount);
}

//给数组添加空无素到一定长度
function appendLen(a, len){
    var ret = a;
    var addlen = len-a.length;
    for(var i=0;i<addlen;i++){
        ret.unshift(null);    
    }
    return ret;
}

//取得两条线的交叉数
function getCrossNum(arr1,arr2) {
    var crossNum = 0;
    if (arr1.length !== arr2.length) {
        if(arr1.length > arr2.length){
			arr2 = appendLen(arr2,arr1.length);
		}else{
			arr1 = appendLen(arr1,arr2.length);
		}
    }
    for (var i = arr1.length - 1; i >= 0; i--) {
        if (typeof(arr1[i]) !== 'number' || typeof(arr2[i]) !== 'number') {
            break;
        }
        if (arr1[i] < arr2[i]) {
            if (crossNum > 0) {
                break;
            }
            crossNum--;
        } else if (arr1[i] > arr2[i]) {
            if (crossNum < 0) {
                break;
            }
            crossNum++;
        } else {
            break;
        }
    }
    return crossNum;
}

// 返回上穿的周期数. 正数为上穿周数, 负数表示下穿的周数, 0指当前价格一样
function Cross(tp, klinetype, a, b) {
	var MAType = 0;
    var pfnMA = [TA.EMA, TA.MA, talib.KAMA][MAType];
    var crossNum = 0;
    var arr1 = [];
    var arr2 = [];
    if (Array.isArray(a)) {
        arr1 = a;
        arr2 = b;
    } else {
        var records = GetRecords(tp, klinetype);
        arr1 = pfnMA(records, a);
        arr2 = pfnMA(records, b);
    }
    return getCrossNum(arr1,arr2);
}

//从帐户中获取当前持仓信息
function getAccountStocks(account){
	var stocks = 0;
	if(account) stocks = account.Stocks;
	return stocks;
}

//处理卖出成功之后数据的调整
function changeDataForSell(tp,account,order){
	//算出扣除平台手续费后实际的数量
	var avgPrice = _G(tp.Name+"_AvgPrice");
	var TotalProfit = _G("TotalProfit");
	var SubProfit = _G(tp.Name+"_SubProfit");
	var profit = parseFloat((order.AvgPrice*order.DealAmount*(1-tp.Args.SellFee) - avgPrice*order.DealAmount).toFixed(tp.Args.PriceDecimalPlace));
	SubProfit += profit;
	TotalProfit += profit;
	tp.Profit = SubProfit;
	_G(tp.Name+"_SubProfit", SubProfit);
	_G("TotalProfit", TotalProfit);
	LogProfit(TotalProfit);
	
	if(order.Status === ORDER_STATE_CLOSED ){
		Log(tp.Title,"交易对订单",_G(tp.Name+"_LastOrderId"),"交易成功!平均卖出价格：",order.AvgPrice,"，平均持仓价格：",avgPrice,"，卖出数量：",order.DealAmount,"，毛收盈：",profit,"，累计毛收盈：",TotalProfit);
	}else{
		Log(tp.Title,"交易对订单",_G(tp.Name+"_LastOrderId"),"部分成交!卖出数量：",order.DealAmount,"，剩余数量：",order.Amount - order.DealAmount,"，平均卖出价格：",order.AvgPrice,"，平均持仓价格：",avgPrice,"，毛收盈：",profit,"，累计毛收盈：",TotalProfit);
	}
	
	//是否发生了超跌且抄底价格高于持仓均价的情况，如果是不能处理退出点之后的代码
	var needreturn = false;
	//如果是抄底平仓（平仓价格低于指导卖出价）不执行以下代码
	if(_G(tp.Name+"_OverFallBuy") && order.AvgPrice < _G(tp.Name+"_LastSellPrice")){
		needreturn = true;
	}

	//设置最后一次卖出价格
	if(!needreturn && order.DealAmount>(order.Amount/2)){
		_G(tp.Name+"_LastSellPrice",parseFloat(order.AvgPrice));
	}
	
	//如果当前持仓数量小于最小交量数量或最小持仓量时，指导买入价格重置为成交价和平均价的中间价，方便短线操作
	var coinAmount = getAccountStocks(account); //从帐户中获取当前持仓信息
	if(coinAmount <= tp.Args.MinCoinLimit+tp.Args.TradeLimits.MPOMinSellAmount*2 ){
		var guideBuyPrice = parseFloat(((order.AvgPrice+avgPrice)/2).toFixed(tp.Args.PriceDecimalPlace));
		Log(tp.Title,"交易对空仓至最小持币量，将指导买入价调整为",guideBuyPrice);
		_G(tp.Name+"_LastBuyPrice",guideBuyPrice);
		_G(tp.Name+"_BuyGuidePrice",guideBuyPrice);
		_G(tp.Name+"_LastSellPrice",0);
		//币价回升重置回撤处理
		if(_G(tp.Name+"_HandledRetreat")) _G(tp.Name+"_HandledRetreat", 0);
		//重新计算操作粒度
		if(exchanges.length == 1) _G(tp.Name+"_OperateFineness", parseFloat((account.Balance/guideBuyPrice/Transaction_Depth).toFixed(tp.Args.StockDecimalPlace)));
	}else{
		//卖出成功，重置上一次买入价格，以方便下跌补仓
		_G(tp.Name+"_LastBuyPrice",0);
	}
	
	//列新交易次数
	var tradeTimes = _G(tp.Name+"_SellTimes");
	tradeTimes++;
	_G(tp.Name+"_SellTimes",tradeTimes);
	
	//如果是抄底平仓不执行以下代码
	if(needreturn){
		Log("本次卖出为抄底平仓，不执行以下代码，直接退出")
		return;
	}
	
	//调整动态点数
	var sellDynamicPoint = _G(tp.Name+"_SellDynamicPoint");
	if(_G(tp.Name+"_HandledRetreat") > 0){
		//进入回撤模式的卖出
		sellDynamicPoint += Math.abs(tp.Args.SellPoint/2);
	}else{
		//正常卖出
		var newsdp = sellDynamicPoint + tp.Args.AddPointInSell;
		sellDynamicPoint = newsdp < 0.001 ? 0.001 : newsdp;
	}
	_G(tp.Name+"_SellDynamicPoint", sellDynamicPoint);
	var buyDynamicPoint = _G(tp.Name+"_BuyDynamicPoint");
	if(buyDynamicPoint != tp.Args.BuyPoint) _G(tp.Name+"_BuyDynamicPoint", tp.Args.BuyPoint);
}

//检测卖出订单是否成功
function checkSellFinish(tp,account){
    var ret = true;
	var lastOrderId = _G(tp.Name+"_LastOrderId");
	var order = tp.Exchange.GetOrder(lastOrderId);
	if(order.Status === ORDER_STATE_CLOSED ){
		changeDataForSell(tp,account,order);
	}else if(order.Status === ORDER_STATE_PENDING ){
		if(order.DealAmount){
			changeDataForSell(tp,account,order);
		}else{
			if(order.Price){
				Log(tp.Title,"交易对订单",lastOrderId,"未有成交!卖出价格：",order.Price,"，当前价：",GetTicker(tp).Last,"，价格差：",_N(order.Price - GetTicker(tp).Last, tp.Args.PriceDecimalPlace));
			}else{
				Log(tp.Title,"交易对市价卖出订单",lastOrderId,"未有成交!");
				ret = false;
			}
		}
		//撤消没有完成的限价订单
		if(order.Price){
			tp.Exchange.CancelOrder(lastOrderId);
			Log(tp.Title,"交易对取消卖出订单：",lastOrderId);
			Sleep(1300);
		}
	}
    return ret;
}

//处理买入成功之后数据的调整
function changeDataForBuy(tp,account,order){
	//读取原来的持仓均价和持币总量
	var avgPrice = _G(tp.Name+"_AvgPrice");
	var beforeBuyingStocks = _G(tp.Name+"_BeforeBuyingStocks");
	if(order.Status === ORDER_STATE_CLOSED ){
		Log(tp.Title,"交易对订单",_G(tp.Name+"_LastOrderId"),"买入交易已经成功!成交均价：",order.AvgPrice,"，挂单买入：",order.Amount,"，买到数量：",order.DealAmount);			
	}else{
		Log(tp.Title,"交易对订单",_G(tp.Name+"_LastOrderId"),"买入交易已经部分成交!成交均价：",order.AvgPrice,"，挂单买入：",order.Amount,"，买到数量：",order.DealAmount);		
	}
	
	var flag = false;	
	if(beforeBuyingStocks > tp.Args.MinCoinLimit+tp.Args.TradeLimits.MPOMinSellAmount){
		if(order.DealAmount > _G(tp.Name+"_OperateFineness")){
			//检测当前是否存在短线交易
			if(tp.Sssts.length ){
				//存在，检测当前交易是否完成,没有完成强制取消挂单
				Log(tp.Title,"交易对先前存在短线交易挂单，现检测当前交易是否完成,没有完成强制取消挂单。");
				var ret = checkSsstSellFinish(tp, true);
				if(!ret){
					//如果挂单还没有取消成功,再次尝试取消挂单
					for(var i=0;i<tp.Sssts.length;i++){
						tp.Exchange.CancelOrder(tp.Sssts[i].OrderID);
					}
				}
			}
			//再次检测是否有未完成的挂单
			if(tp.Sssts.length){
				var Amount = 0;
				var BuyPrice = tp.Sssts[0].BuyPrice;
				for(var i=0;i<tp.Sssts.length;i++){
					Amount += tp.Sssts[i].Amount;
				}
				Log(tp.Title,"交易对先前的短线交易挂单未完成，现将其未完成的量",Amount,"按",BuyPrice,"买入计入长线核算。");
				//有挂单没有完成，将挂单数量和金额计入持仓均价
				var coinAmount = beforeBuyingStocks + Amount;
				//计算持仓总价
				var Total = parseFloat((avgPrice*beforeBuyingStocks + BuyPrice * Amount*(1+tp.Args.BuyFee)).toFixed(tp.Args.PriceDecimalPlace));
				
				//计算并调整平均价格
				avgPrice = parseFloat((Total / coinAmount).toFixed(tp.Args.PriceDecimalPlace));
				_G(tp.Name+"_AvgPrice",avgPrice);
				
				Log(tp.Title,"交易对先前的短线交易挂单买入价：",BuyPrice,"，未卖出数量：",Amount,"，长线持仓价格调整到：",avgPrice,"，总持仓数量：",coinAmount,"，总持币成本：",Total);			
				
				//保存每次买入之后币的数量
				_G(tp.Name+"_lastBuycoinAmount", coinAmount);
				
				//调整新的beforeBuyingStocks变量，以方便下面的计算
				beforeBuyingStocks = coinAmount;
			}
			
			//清空原来的挂单数组内容
			tp.Sssts = [];
		}
		
		if(!tp.Sssts.length && checkCanDoSsst(tp, account)){
			//将当前买入作为短线卖单挂出
			Log(tp.Title,"交易对计划对当前成功的买入量做短线卖出挂单。");
			var finish = false;
			for(var i=0;i<3;i++){
				var newSsst = new SsstData();
				newSsst.Type = 1;
				newSsst.BuyPrice = order.AvgPrice;
				newSsst.Amount = order.DealAmount/3;
				var profit = THRID_ORDERY_LEVELS[i];
				newSsst.Level = profit;
				newSsst.SellPrice = parseFloat((order.AvgPrice*(1+profit+tp.Args.BuyFee+tp.Args.SellFee)).toFixed(tp.Args.PriceDecimalPlace));
				tp.Exchange.SetPrecision(tp.Args.PriceDecimalPlace, tp.Args.StockDecimalPlace);
				var orderid = tp.Exchange.Sell(newSsst.SellPrice, newSsst.Amount);
				if(orderid){
					//挂单成功
					Log(tp.Title,"交易对将当前成功的买入量的1/3做",profit*100,"%卖出挂单成功，订单编号",orderid);
					newSsst.OrderID = orderid;
					newSsst.OrderTime = new Date().getTime();
					newSsst.LastBuyPrice = _G(tp.Name+"_LastBuyPrice");
					tp.Sssts.push(newSsst);
					//保存挂单信息
					_G(tp.Name+"_Ssst_Type"+i, newSsst.Type);
					_G(tp.Name+"_Ssst_Level"+i, newSsst.Level);
					_G(tp.Name+"_Ssst_BuyPrice"+i, newSsst.BuyPrice);
					_G(tp.Name+"_Ssst_Amount"+i, newSsst.Amount);
					_G(tp.Name+"_Ssst_SellPrice"+i, newSsst.SellPrice);
					_G(tp.Name+"_Ssst_OrderID"+i, newSsst.OrderID);
					_G(tp.Name+"_Ssst_OrderTime"+i, newSsst.OrderTime);	
					//设置标签
					finish = true;
				}
			}
			//挂单完成
			if(finish){
				//做个延时处理
				Sleep(5000);
				//重新读取Account账户变动
				account = GetAccount(tp);
			}else{
				Log(tp.Title,"交易对计划对当前买入做挂单，但挂单不成功，现将其按长线买入计入长线核算。");
				//有挂单不成功，将数量和金额计入长线核算
				flag = true;
			}
		}else{
			Log(tp.Title,"交易对现在不允许做短线交易操作，现将直接按长线买入计入长线核算。");
			flag = true;
		}
	}else{
		//当前持仓量小于最小持仓量和最小交易量的总和，不作短线卖出挂单，直接计入长线核算
		flag = true;
	}
	
	//判断是否发生了超跌且抄底买入价值小于原来持仓价值的情况，如果是不能处理退出点之后的代码
	var needreturn = false;
	//如果是正叉阶段的买入（超跌抄底）到此为止，下面代码不能执行
	if(_G(tp.Name+"_OverFallBuy") && avgPrice*_G(tp.Name+"_OverFallBefore") > order.AvgPrice*order.DealAmount){
		needreturn = true;
	}
	
	//核算总持币量
	var coinAmount = beforeBuyingStocks + order.DealAmount;
	//是否对当前买入量计入长线核算
	if(flag){
		//计算持仓总价
		var Total = parseFloat((avgPrice*beforeBuyingStocks+order.AvgPrice * order.DealAmount*(1+tp.Args.BuyFee)).toFixed(tp.Args.PriceDecimalPlace));
		
		//计算并调整平均价格
		avgPrice = parseFloat((Total / coinAmount).toFixed(tp.Args.PriceDecimalPlace));
		_G(tp.Name+"_AvgPrice",avgPrice);
		
		Log(tp.Title,"交易对当前买入计入核算，长线持仓价格调整到：",avgPrice,"，总持仓数量：",coinAmount,"，总持币成本：",Total);			
	}
	
	//设置最后一次买入价格,仅在买入量超过一半的情况下调整最后买入价格，没到一半继续买入
	if(order.Price != 0 && order.DealAmount>(order.Amount/2) || order.Price == 0 && order.DealAmount>(order.Amount/order.AvgPrice/2)){
		_G(tp.Name+"_LastBuyPrice",parseFloat(order.AvgPrice));
	}

	//列新交易次数
	var tradeTimes = _G(tp.Name+"_BuyTimes");
	tradeTimes++;
	_G(tp.Name+"_BuyTimes",tradeTimes);
	
	//如果是正叉阶段的买入（超跌抄底）到此为止，下面代码不能执行
	if(needreturn){
		Log("发生了超跌抄底，不操作以下代码，直接退出");
		return;
	}
	
	//保存每次买入之后币的数量
	_G(tp.Name+"_lastBuycoinAmount", coinAmount);
	
	//每次买入一次重置上一次卖出价格，方便以新的成本价计算下次卖出价
	_G(tp.Name+"_LastSellPrice",0);
	_G(tp.Name+"_HistoryHighPoint", 0);
	
	//调整动态点数
	var buyDynamicPoint = _G(tp.Name+"_BuyDynamicPoint");
	var loc = getInDayLineLocation(tp);
	if((loc.Now-loc.Low)/(loc.High-loc.Low) < 0.1){
		var newbdp = buyDynamicPoint - tp.Args.AddPointInBuy;
		buyDynamicPoint = newbdp < tp.Args.BuyPoint ? tp.Args.BuyPoint : newbdp;
		_G(tp.Name+"_BuyDynamicPoint", buyDynamicPoint - tp.Args.AddPointInBuy);
	}else{
		_G(tp.Name+"_BuyDynamicPoint", buyDynamicPoint + tp.Args.AddPointInBuy);
	}
	var sellDynamicPoint = _G(tp.Name+"_SellDynamicPoint");
	if(sellDynamicPoint != tp.Args.SellPoint) _G(tp.Name+"_SellDynamicPoint", tp.Args.SellPoint);	
}

//检测买入订单是否成功
function checkBuyFinish(tp,account){
	var ret = true;
	var lastOrderId = _G(tp.Name+"_LastOrderId");
	var order = tp.Exchange.GetOrder(lastOrderId);
	if(order.Status === ORDER_STATE_CLOSED ){
		//处理买入成功后的数据调整
		changeDataForBuy(tp,account,order);
	}else if(order.Status === ORDER_STATE_PENDING ){
		if(order.DealAmount){
			//处理买入成功后的数据调整
			changeDataForBuy(tp,account,order);
		}else{
			if(order.Price){
				Log(tp.Title,"交易对买入订单",lastOrderId,"未有成交!订单买入价格：",order.Price,"，当前卖一价：",GetTicker(tp).Sell,"，价格差：",_N(order.Price - GetTicker(tp).Sell, tp.Args.PriceDecimalPlace));
			}else{
				Log(tp.Title,"交易对市价买入订单",lastOrderId,"未有成交!");
				ret = false;
			}
		}
		//撤消没有完成的限价订单
		if(order.Price){
			tp.Exchange.CancelOrder(lastOrderId);
			Log(tp.Title,"交易对取消未完成的买入订单：",lastOrderId);
			Sleep(1300);
		}
	}
	return ret;
}

//取得指定交易对
function getTradePair(name){
	var tp;
	for(var i=0;i<TradePairs.length;i++){
		if(TradePairs[i].Name == name){
			tp = TradePairs[i];
			break;
		}
	}
	return tp;
}

//策略交互处理函数
function commandProc(cmd){
	if(cmd){
		var cmds=cmd.split(":");
		var values;
		var tp;
		if(cmds.length === 2){
			if(cmds[0] == "ConditionOperation"){
				Log("接收到条件操作命令",cmds[1]);
				values = cmds[1].split("|");
				var ConditionCmds = _G("ConditionCmds") ? _G("ConditionCmds") : [];
				if(values.length >= 3){
					ConditionCmds.push(new Date().getTime()+"|"+cmds[1]);
					_G("ConditionCmds",ConditionCmds);
				}else{
					if(values[0] == "Cancel"){
						var newcmds = [];
						for(var i = 0;i<ConditionCmds.length;i++){
							if(ConditionCmds[i].indexOf(values[1]) == -1){
								newcmds.push(ConditionCmds[i]);
							}else{
								Log("取消条件操作命令",ConditionCmds[i]);
							}
						}
						_G("ConditionCmds", newcmds);
					}
				}
				return;
			}else if(cmds[0] == "ClearLog"){
				Log("接收到清除日志命令");
				var lognum = parseInt(cmds[1]);
				if(lognum >= 0){
					//清除日志
					if(lognum){
						LogReset(lognum);
					}else{
						LogReset();
					}
					//回收SQLite空间
					LogVacuum();
					Log("日志清除完成，请刷新页面。"," #0000FF")
				}else{
					Log("提供的保留记录条数非法值，拒绝操作！！！");
				}
			}else{
				values = cmds[1].split("|");
				if(values.length >= 2){
					if(values[0].toUpperCase() != "ALL"){
						tp = getTradePair(values[0]);
						if(!tp){
							Log("没有取到相应的交易对，请确认交易对名称的正确性，格式为交易所名_交易对名!。 #FF0000");
							return;
						}
					}
				}else{
					Log("提交的交互内容格式不正式，格式为_|_!。 #FF0000");
					return;
				}
			}
			if(cmds[0] == "NewAvgPrice"){
				if(values[1] == '0'){
					Log(tp.Title,"尝试更新持仓价格为0，拒绝操作！！！");
				}else{
					var newprice = parseFloat(values[1]);
					Log(tp.Title,"更新持仓价格为",newprice);
					_G(tp.Name+"_AvgPrice",newprice);
					if(newprice < _G(tp.Name+"_AvgPrice") && newprice < _G(tp.Name+"_LastBuyPrice")) _G(tp.Name+"_LastBuyPrice",newprice);
					AccountTables = null;
				}
			}else if(cmds[0] == "GuideBuyPrice"){
				var newprice = parseFloat(values[1]);
				if(newprice <= 0){
					Log(tp.Title,"不能设置价格为0或负数的指导买入价格！！！");
				}else{
					Log(tp.Title,"更新指导买入价格为",newprice);
					if(newprice < _G(tp.Name+"_BuyGuidePrice") && newprice < _G(tp.Name+"_LastBuyPrice")) _G(tp.Name+"_LastBuyPrice",newprice);
					_G(tp.Name+"_BuyGuidePrice",newprice);
					AccountTables = null;
				}
			}else if(cmds[0] == "LastBuyPrice"){
				var newprice = parseFloat(values[1]);
				if(newprice < 0){
					Log(tp.Title,"不能设置价格为负数的上次买入价格！！！");
				}else{
					Log(tp.Title,"更新上次买入价格为",newprice);
					_G(tp.Name+"_LastBuyPrice",newprice);
					AccountTables = null;
				}
			}else if(cmds[0] == "LastSellPrice"){
				var newprice = parseFloat(values[1]);
				if(newprice < 0){
					Log(tp.Title,"不能设置价格为负数的上次卖出价格！！！");
				}else{
					Log(tp.Title,"更新上次卖出价格为",newprice);
					_G(tp.Name+"_LastSellPrice",newprice);
					AccountTables = null;
				}
			}else if(cmds[0] == "NewBuyPoint"){
				if(values[0].toUpperCase() == "ALL"){
					for(var i=0;i<TradePairs.length;i++){
						tp = TradePairs[i];
						_G(tp.Name+"_BuyDynamicPoint",parseFloat(values[1]));
					}
					Log("更新所有交易对的动态买入点为",values[1]," #FF0000");
				}else{				
					if(values[1] == '0'){
						Log(tp.Title,"尝试更新动态买入点为0，拒绝操作！！！");
					}else{
						Log(tp.Title,"更新动态买入点为",values[1]);
						_G(tp.Name+"_BuyDynamicPoint",parseFloat(values[1]));
						AccountTables = null;
					}
				}
			}else if(cmds[0] == "NewSellPoint"){
				if(values[0].toUpperCase() == "ALL"){
					for(var i=0;i<TradePairs.length;i++){
						tp = TradePairs[i];
						_G(tp.Name+"_SellDynamicPoint",parseFloat(values[1]));
					}
					Log("更新所有交易对的动态卖出点为",values[1]," #FF0000");
				}else{				
					if(values[1] == '0'){
						Log(tp.Title,"尝试更新动态卖出点为0，拒绝操作！！！");
					}else{
						Log(tp.Title,"更新动态卖出点为",values[1]);
						_G(tp.Name+"_SellDynamicPoint",parseFloat(values[1]));
						AccountTables = null;
					}
				}
			}else if(cmds[0] == "NewOperateFineness"){
				var nof = parseFloat((values[1]).toFixed(tp.Args.StockDecimalPlace));
				if(!nof || nof <= 0){
					Log(tp.Title,"尝试更新操作粒度为小于等于0的数值，拒绝操作！！！");
				}else{
					Log(tp.Title,"更新操作粒度为",values[1]);
					_G(tp.Name+"_OperateFineness",nof);
					AccountTables = null;
				}
			}else if(cmds[0] == "SsstSwitch"){
				if(values[0].toUpperCase() == "ALL"){
					for(var i=0;i<TradePairs.length;i++){
						tp = TradePairs[i];
						_G(tp.Name+"_Ssst_CanDo",parseInt(values[1]));
					}
					Log("更新所有交易对的短线交易开关为",values[1]," #FF0000");
				}else{
					Log(tp.Title,"更新短线交易开关为",values[1]);
					_G(tp.Name+"_Ssst_CanDo",parseInt(values[1]));
				}
				AccountTables = null;
			}else if(cmds[0] == "ManualOperation"){
				var checkarg = true;
				if(values.length < 3 || values.length > 5 || ['0','1','2'].indexOf(values[1]) == -1){
					checkarg = false;
				}else if(values.length == 4 && (isNaN(values[2]) ||  isNaN(values[3]))){
					checkarg = false;
				}else if(values.length == 5 && values[4] != "1"){
					checkarg = false;
				}
				if(!checkarg){
					Log("提供的值的格式不对，正确的填写格式如下:TradePairName|Type(0取消/1卖出/2买入)|Price/OrderID|Amount");
				}else{
					if(values[1] == "0"){
						//取消挂单
						Log("接收到策略互动操作要求取消MO交易挂单，订单编号",values[2]);
						tp.Exchange.CancelOrder(values[2]);
					}else{
						Log("接收到策略互动操作",values.length == 5 ? '强制' : '' ,"要求以",values[2] == '-1' ? '市价' : values[2]+'的价格',values[1] == '1' ? '卖出' : '买入',values[0],"交易对",values[3],"个币。");
						var orderid = 0;
						var Account = GetAccount(tp);
						var Ticker = GetTicker(tp);
						var Price = -1;
						if(values[2] != "-1") Price = eval(values[2]+"+0");
						var Amount = eval(values[3]+"+0");
						if(values[1] == "1"){
							if((Account.Stocks - tp.Args.MinCoinLimit) < Amount){
								Log(tp.Title+"交易对的可卖出数量不足",Amount,"，卖出失败。 #FF0000");
							}else if(values.length == 4 && Price != -1 && Price < _G(tp.Name+"_AvgPrice")){
								Log(tp.Title+"交易对计划卖出价格",Price,"低于成本价",_G(tp.Name+"_AvgPrice"),"，卖出失败。 #FF0000");
							}else if(values.length == 4 && Price == -1 && Ticker.Buy < _G(tp.Name+"_AvgPrice")){
								Log(tp.Title+"交易对计划以市价卖出，但当前市价",Ticker.Buy,"低于成本价",_G(tp.Name+"_AvgPrice"),"，卖出失败。 #FF0000");
							}else if( values.length == 5 && Amount > _G(tp.Name+"_OperateFineness")){
								Log(tp.Title+"交易对计划低于成本价强制卖出，但卖出数量超过了规定限制，卖出失败。 #FF0000");
							}else if(Price != -1 && Price < Ticker.Last*0.99){
								Log(tp.Title+"交易对计划卖出价格",Price,"低于当前价格",Ticker.Last,"的99%，卖出失败。 #FF0000");
							}else if(Price == -1 && Amount < tp.Args.TradeLimits.MPOMinSellAmount && Amount > tp.Args.TradeLimits.MPOMaxSellAmount){
								Log(tp.Title+"交易对计划卖出数量超出交易限制，市价卖出单最小限量",tp.Args.TradeLimits.MPOMinSellAmount,"最大限量",tp.Args.TradeLimits.MPOMaxSellAmount,"。 #FF0000");
							}else if(Price != -1 && Amount < tp.Args.TradeLimits.LPOMinAmount && Amount > tp.Args.TradeLimits.LPOMaxAmount){
								Log(tp.Title+"交易对计划卖出数量超出交易限制，限价卖出单最小限量",tp.Args.TradeLimits.LPOMinAmount,"最大限量",tp.Args.TradeLimits.LPOMaxAmount,"。 #FF0000");
							}else{
								tp.Exchange.SetPrecision(tp.Args.PriceDecimalPlace, tp.Args.StockDecimalPlace);
								if(Price == -1) Amount=_N(Amount,tp.Args.PriceDecimalPlace);
								orderid = tp.Exchange.Sell(Price, Amount);
								if(orderid){
									Log(tp.Title+"交易对应策略互动操作",values.length == 5 ? '强制' : '' ,"要求以",values[2] == '-1' ? '市价' : values[2]+'的价格',"卖出",values[3],"个币，订单提交成功，订单编号：",orderid);
								}else{
									Log(tp.Title+"交易对应策略互动操作",values.length == 5 ? '强制' : '' ,"要求以",values[2] == '-1' ? '市价' : values[2]+'的价格',"卖出",values[3],"个币，订单提交失败。");
								}
							}
						}else{
							var buyprice = Ticker.Sell;
							if(Price != -1) buyprice = Price;
							var canpay = (tp.Args.MaxCoinLimit - Account.Stocks) * buyprice;
							if(Account.Balance < canpay){
								canpay = Account.Balance;
							}
							var canbuy = canpay/buyprice;
							canbuy = _N(canbuy, tp.Args.StockDecimalPlace);
                            if(Price != -1 && Price > _G(tp.Name+"_AvgPrice")*1.20){
								Log(tp.Title+"交易对计划买入价格",Price,"高于成本价",_G(tp.Name+"_AvgPrice"),"的1.2倍，买入操作失败。 #FF0000");
							}else if(Price != -1 && Price > Ticker.Last*1.01){
								Log(tp.Title+"交易对计划买入价格",Price,"高于当前价格",Ticker.Last,"的1.01倍，买入操作失败。 #FF0000");
							}else if(Price == -1 && Amount < tp.Args.TradeLimits.MPOMinBuyAmount && Amount > tp.Args.TradeLimits.MPOMaxBuyAmount){
								Log(tp.Title+"交易对计划卖出数量超出交易限制，市价买入单最小限量",tp.Args.TradeLimits.MPOMinBuyAmount,"最大限量",tp.Args.TradeLimits.MPOMaxBuyAmount,"。 #FF0000");
							}else if(Price != -1 && Amount < tp.Args.TradeLimits.LPOMinAmount && Amount > tp.Args.TradeLimits.LPOMaxAmount){
								Log(tp.Title+"交易对计划卖出数量超出交易限制，限价买入单最小限量",tp.Args.TradeLimits.LPOMinAmount,"最大限量",tp.Args.TradeLimits.LPOMaxAmount,"。 #FF0000");
							}else{
								var msg = tp.Name+"交易对应策略互动操作要求以";
                                if(Price == -1){
                                    if(canpay < Amount){
                                        Amount = canpay;
                                    }
                                    if(tp.Args.TradeLimits.MPOMaxBuyAmount < Amount){
		                                Amount = tp.Args.TradeLimits.MPOMaxBuyAmount;
		                            }
									msg = "市价买入价值"+values[3]+"的币，最终核算下来花费"+Amount;
									//设置小数位，第一个为价格小数位，第二个为数量小数位
									tp.Exchange.SetPrecision(tp.Args.PriceDecimalPlace, tp.Args.PriceDecimalPlace);
                                }else{
                                    if(canbuy < Amount){
                                        Amount = canbuy;
                                    }
                                    if(tp.Args.TradeLimits.LPOMaxAmount < Amount){
		                            	Amount = tp.Args.TradeLimits.LPOMaxAmount;
		                            }
									msg = values[2]+"的价格买入"+values[3]+"个币，最终核算下来买入"+Amount+"币";
									//设置小数位，第一个为价格小数位，第二个为数量小数位
									tp.Exchange.SetPrecision(tp.Args.PriceDecimalPlace, tp.Args.StockDecimalPlace);
                                }
								orderid = tp.Exchange.Buy(Price, Amount);
								if(orderid){
									Log(msg,"，订单提交成功，订单编号：",orderid);
									_G(tp.Name+"_BeforeBuyingStocks",Account.Stocks);
								}else{
									Log(msg,"，订单提交失败。");
								}
							}
						}
						if(orderid){
							//将交易编号推入MO交易挂单列表中。
							MOOrders.push(tp.Name+"|"+orderid);
						}
					}
				}
			}else if(cmds[0] == "OperationLog"){
				if(values[0].toUpperCase() == "ALL"){
					Log("交易日志：",cmds[1]);
				}else{
					Log(tp.Title,"交易日志：",cmds[1]);
				}
			}else if(cmds[0] == "Debug"){
				if(values[0].toUpperCase() == "ALL"){
					for(var i=0;i<TradePairs.length;i++){
						tp = TradePairs[i];
						_G(tp.Name+"_Debug",parseInt(values[1]));
					}
					Log("更新所有交易对调试状态为",values[1]," #FF0000");
				}else{
					if(tp){
						_G(tp.Name+"_Debug",parseInt(values[1]));
						Log("更新",tp.Name,"交易对调试状态为",values[1]," #FF0000");
					}
				}
				AccountTables = null;
			}
		}else{
			Log("提交的交互内容格式不正式，格式为_|_! #FF0000");
		}
	}
}

//策略交互条件操作处理函数
function procConditionCmd(tp){
	var ConditionCmds = _G("ConditionCmds");
	if(!ConditionCmds) ConditionCmds = [];
	if(ConditionCmds){
		var needupdate = false;
		var newcmds = [];
		for(var i = 0;i<ConditionCmds.length;i++){
			var docmd = false;
			var cmds = ConditionCmds[i].split("|");
			if(cmds && cmds.length>=4){
				//判断交易对
				if(cmds[3] == tp.Name){
					//判断条件
					var ticker = tp.Exchange.GetTicker();
					var cds = cmds[1];
					cds = cds.replace(new RegExp("Price","gm"),ticker.Last);
					cds = cds.replace(new RegExp("CrossNum","gm"),DayLineCrossNum);
					if(eval(cds)){
						//还原命令
						var cmd = "";
						for(var l = 2; l<cmds.length; l++){
							if(l === 2){
								cmd = cmds[l]+":";
							}else if(l === 3){
								cmd += cmds[l];
							}else{
								cmd += "|" + cmds[l];
							}
						}
						//执行命令
						Log(tp.Title,"当前币价",cds,"符合条件，执行命令",cmd);
						commandProc(cmd);
						docmd = true;
						needupdate = true;
					}
				}
			}
			if(!docmd) newcmds.push(ConditionCmds[i]);
		}
		//更新本地存储
		if(needupdate){
			_G("ConditionCmds", newcmds);
		}
	}
}

//检测短线卖出订单是否成功
function checkSsstSellFinish(tp, cancelorder){
	var ret = true;
	for(var i=0;i<tp.Sssts.length;i++){
		if(tp.Sssts[i].Type == 1 && tp.Sssts[i].OrderID){
			var order = tp.Exchange.GetOrder(tp.Sssts[i].OrderID);
			if(!order) continue;
			if(order.Status === ORDER_STATE_CLOSED || order.Status === ORDER_STATE_PENDING && cancelorder && order.DealAmount){
				//累计盈利
				var TotalProfit = _G("TotalProfit");
				var SubProfit = _G(tp.Name+"_SubProfit");
				var profit = parseFloat((order.AvgPrice*order.DealAmount*(1-tp.Args.SellFee) - tp.Sssts[i].BuyPrice*order.DealAmount*(1+tp.Args.BuyFee)).toFixed(tp.Args.PriceDecimalPlace));
				SubProfit += profit;
				TotalProfit += profit;
				tp.Profit = SubProfit;
				_G(tp.Name+"_SubProfit", SubProfit);
				_G("TotalProfit", TotalProfit);
				LogProfit(TotalProfit);
		
				if(order.Status === ORDER_STATE_CLOSED){
					Log(tp.Title,"交易对短线挂单",tp.Sssts[i].OrderID,"交易成功!卖出价格：",order.AvgPrice,"，买入价格：",tp.Sssts[i].BuyPrice,"，卖出数量：",order.DealAmount,"，毛收盈：",profit,"，累计毛收盈：",TotalProfit);
				}else{
					Log(tp.Title,"交易对短线挂单",tp.Sssts[i].OrderID,"部分成交!卖出数量：",order.DealAmount,"，剩余数量：",order.Amount - order.DealAmount,"，卖出价格：",order.AvgPrice,"，买入价格：",avgPrice,"，毛收盈：",profit,"，累计毛收盈：",TotalProfit);
				}
				
				//列新交易次数
				var tradeTimes = _G(tp.Name+"_SellTimes");
				tradeTimes++;
				_G(tp.Name+"_SellTimes",tradeTimes);
				
				//更新剩余数量到Ssst对像
				if(order.Status === ORDER_STATE_PENDING && order.DealAmount && cancelorder){
					tp.Sssts[i].Amount = order.Amount - order.DealAmount;
					_G(tp.Name+"_Ssst_Amount"+i, tp.Sssts[i].Amount);
				}
			}
		
			if(order.Status === ORDER_STATE_CLOSED && !cancelorder){
				//再以挂单的买入价，再挂限价单买入。
				Log(tp.Title,"交易对短线卖出成功，再次以价格",tp.Sssts[i].BuyPrice,"挂限价单买入",tp.Sssts[i].Amount,"个币");
				tp.Exchange.SetPrecision(tp.Args.PriceDecimalPlace, tp.Args.StockDecimalPlace);
				var orderid = tp.Exchange.Buy(tp.Sssts[i].BuyPrice, tp.Sssts[i].Amount);
				if(_G(tp.Name+"_Ssst_CanDo")){
					if(orderid){
						Log(tp.Title,"交易对短线再次买入挂单成功，新订单编号：",orderid);
						tp.Sssts[i].Type = 2;
						tp.Sssts[i].OrderID = orderid;
						tp.Sssts[i].OrderTime = new Date().getTime();
					}else{
						Log(tp.Title,"交易对短线再次买入挂单失败，更改订单状态");
						tp.Sssts[i].Type = 0;
						tp.Sssts[i].OrderID = 0;
						tp.Sssts[i].OrderTime = 0;
					}
					_G(tp.Name+"_Ssst_Type"+i, tp.Sssts[i].Type);
					_G(tp.Name+"_Ssst_OrderID"+i, tp.Sssts[i].OrderID);
					_G(tp.Name+"_Ssst_OrderTime"+i, tp.Sssts[i].OrderTime);
				}else{
					if(orderid){
						_G(tp.Name+"_OperatingStatus",OPERATE_STATUS_BUY);
						_G(tp.Name+"_LastOrderId",orderid);
						_G(tp.Name+"_BeforeBuyingStocks",GetAccount(tp).Stocks);
						Log("短线卖单成功卖出之后，短线交易标识为关闭状态，转为长线买入此数量，订单编号：",orderid);
					}else{
						Log("短线卖单成功卖出之后，尝试转为长线买入此数量，挂单失败");
					}
					tp.Sssts[i].Type = 0;
					tp.Sssts[i].OrderID = 0;
					tp.Sssts[i].OrderTime = 0;
					_G(tp.Name+"_Ssst_Type"+i, tp.Sssts[i].Type);
					_G(tp.Name+"_Ssst_OrderID"+i, tp.Sssts[i].OrderID);
					_G(tp.Name+"_Ssst_OrderTime"+i, tp.Sssts[i].OrderTime);
				}
			}else{
				//撤消没有完成的订单
				if(cancelorder){
					if(order.Status === ORDER_STATE_PENDING){
						Log(tp.Title,"交易对取消未完成的短线交易挂单：",tp.Sssts[i].OrderID);			
						var retc = tp.Exchange.CancelOrder(tp.Sssts[i].OrderID);
						if(retc){
							tp.Sssts[i].OrderID = 0;
							tp.Sssts[i].OrderTime = 0;
							_G(tp.Name+"_Ssst_OrderID"+i, 0);
							_G(tp.Name+"_Ssst_OrderTime"+i, 0);
						}else{
							ret = false;						
						}
					}else{
						tp.Sssts[i].OrderID = 0;
						tp.Sssts[i].OrderTime = 0;
						_G(tp.Name+"_Ssst_OrderID"+i, 0);
						_G(tp.Name+"_Ssst_OrderTime"+i, 0);
					}
				}
			}
		}
	}
	return ret;
}


//检测短线买入订单是否成功
function checkSsstBuyFinish(tp){
	for(var i=0;i<tp.Sssts.length;i++){
		if(tp.Sssts[i].Type == 2){
			var order = tp.Exchange.GetOrder(tp.Sssts[i].OrderID);
			if(!order) continue;
			if(order.Status === ORDER_STATE_CLOSED){
				Log(tp.Title,"交易对再次限价挂单买入交易已经成功，订单编号",tp.Sssts[i].OrderID);
				//列新交易次数
				var tradeTimes = _G(tp.Name+"_BuyTimes");
				tradeTimes++;
				_G(tp.Name+"_BuyTimes",tradeTimes);
				tp.Exchange.SetPrecision(tp.Args.PriceDecimalPlace, tp.Args.StockDecimalPlace);
				var orderid = tp.Exchange.Sell(tp.Sssts[i].SellPrice, tp.Sssts[i].Amount);
				if(orderid){
					//挂单成功
					tp.Sssts[i].Type = 1;
					tp.Sssts[i].OrderID = orderid;
					tp.Sssts[i].OrderTime = new Date().getTime();
					Log(tp.Title,"交易对再次将买入的量再重新挂卖单卖出，订单编号",orderid);
					//保存挂单信息
					_G(tp.Name+"_Ssst_Type"+i, 1);
					_G(tp.Name+"_Ssst_OrderID"+i, tp.Sssts[i].OrderID);
					_G(tp.Name+"_Ssst_OrderTime"+i, tp.Sssts[i].OrderTime);	
				}
			}
		}
	}
}

//检测短线交易挂单是否成功
function ssstHandle(tp){
	//检测买入挂单是否成功
	checkSsstBuyFinish(tp);
	//检测卖出挂单是否成功
	checkSsstSellFinish(tp, false);
}

/**
 * 取得当前在半年范围内的日线的振幅的位置。
 * @param {} tp
 * @return {}
 */
function getInDayLineLocation(tp){
	var loc = {
		"RecordLength":0,
		"High":0,
		"Low":0,
		"Now":0,
		"LastRecord":{},
		"SecondRecord":{},
		"ThirdRecord":{}
	}
	var records = GetRecords(tp, PERIOD_D1);
	loc.RecordLength = records.length;
	loc.LastRecord = records[records.length - 1];
	var stoptime = loc.LastRecord.Time - 182*24*60*60*1000;
	for(var i=records.length-1;i>=0;i--){
		if(records[i].Time < stoptime) break;
		var close = records[i].Close;
		if(loc.Low === 0 || close < loc.Low) loc.Low = close;
		if(close > loc.High) loc.High = close;
	}
	loc.Now = loc.LastRecord.Close;
	loc.SecondRecord = records[records.length - 2];
	if(!loc.SecondRecord) loc.SecondRecord = loc.LastRecord;
	loc.ThirdRecord = records[records.length - 3];
	if(!loc.ThirdRecord) loc.ThirdRecord = loc.SecondRecord;
	//如果当前天数少于182天，则使用历史高低点修正当前高低点
	if(records.length < 182){
		if(loc.High < tp.Args.HistoryHighPoint) loc.High = tp.Args.HistoryHighPoint;
		if(loc.Low > tp.Args.HistoryLowPoint) loc.Low = tp.Args.HistoryLowPoint;
	}
	return loc;
}

//删除数组的空元素
function deleteNullEle(initArr){
    var dealArr = [];
    var initArrLen = initArr.length;
    for(var i = 0,j = 0 ; i < initArrLen ; i++,j++){
        if(initArr[i] === null || isNaN(initArr[i]) ){
            j--;
            continue;
        }
        dealArr[j] = initArr[i];
    }
    return dealArr;
}

//取得指定周期内的最高价
function getHHV(records, n){
	var max = 0;
	var len = records.length>n?n:records.length;
	for(var i=1;i<=len;i++){
		var high = records[records.length - i].High;
		if(high>max){
			max = high;
		}
	}
	return max;
}

//取得指定周期内的最低价
function getLLV(records, n){
	var min = 0;
	var len = records.length>n?n:records.length;
	for(var i=1;i<=len;i++){
		var low = records[records.length - i].Low;
		if(low<min || min == 0){
			min = low;
		}
	}
	return min;
}

//在数组中取得指定长度的元素组成新数组
function getLenRecords(records, len){
	var ret = [];
	for(var i=0;i<len;i++){
		if(records[i]) ret.push(records[i]);
	}
	return ret;
}

/**
 * 威廉指标(WR)的自己实现
 * talib出来的值有问题，一个是负数，一个是好像不对，自己在网上找的公式写出来
 * WR1:=100*(HHV(HIGH,N1)-CLOSE)/(HHV(HIGH,N1)-LLV(LOW,N1));
 * @param {} records
 * @return []
 */
function getWR(records, n){
	var wr = [];
	for(var i=records.length;i>=1;i--){
		var wrrecords = getLenRecords(records,i);
		var hhv = getHHV(wrrecords,n);
		var llv = getLLV(wrrecords,n);
		var close = wrrecords[wrrecords.length-1].Close;
		var wr1 = 100*(hhv-close)/(hhv-llv);
		if(!wr1) break;
		wr.unshift(wr1);
	}
	return wr;
}


/**
 * 获取几个关键指标数据
 * 1.TRIX线(14,7)的当前两个值：TRIX,MATRIX和两条线的交叉数
 * 2.WR线（14,7）的当前两个值：WR1,WR2和两条线的交叉数
 * 3.KDJ线(6,3,3)的三个值:K,D,J值和KD线交叉数.
 * @param {} tp
 * @param {} account
 * @return {JSON}
 */
function getMainIndicators(records){
	var ret = {
		'TRIX':0,
		'MATRIX':0,
		'TrixCrossNum':0,
		'WR1':0,
		'WR2':0,
		'WRCrossNum':0,
		'K':0,
		'D':0,
		'J':0,
		'KDJCrossNum':0
	};
    var kdj = TA.KDJ(records, 6, 3, 3);
    var ks = kdj[0];
    var ds = kdj[1];
    var js = kdj[2];
    ret.K = ks[ks.length - 1];
    ret.D = ds[ds.length - 1];
    ret.J = js[js.length - 1];
    ret.KDJCrossNum = getCrossNum(ks,ds);
    var trix = talib.TRIX(records, 14);
    var trma = talib.MA(deleteNullEle(trix),7);
    ret.TRIX = trix[trix.length -1];
    ret.MATRIX = trma[trma.length -1];
    ret.TrixCrossNum = getCrossNum(trix,trma);
    var wr1 = getWR(records,14);
    var wr2 = getWR(records,7);
    ret.WR1 = wr1[wr1.length-1];
    ret.WR2 = wr2[wr2.length-1];
    ret.WRCrossNum = getCrossNum(wr1,wr2);
    return ret;
}

/**
 * 通过几个重要指标检测是否要操作止盈
 * 日K线以8点开始：
 * WR(14,7),TRIX(14,7),KDJ(6,3,3)
 * 1.WR两个值都小于5，KDJ3个值平均大于80，EMA为正叉，TRIX交叉数为正，且两个值的差占高值比例不到10%，进行平仓操作
 * 2.WR两个值都小于5，KDJ3个值平均大于80，EMA为正叉，TRIX交叉数为负，进行平仓操作
 * 3.WR两个值都小于5，KDJ3个值平均大于80，EMA为正叉，TRIX交叉数为正，且两个值的差占高值比例大于10%，进行止盈操作
 * 4.WR两个值平均小于10，KDJ3个值平均大于85，EMA为正叉，TRIX交叉数为正，TRIX两值均大于0小于2，进行止盈操作
 * 5.EMA为正叉，TRIX死叉，且TRIX两个值都大于1，KDJ三线死叉，WR两个值均小于30，进行平仓操作
 * 日K线以0点开始：
 * WR(14,7),TRIX(14,7),KDJ(6,3,3)
 * 1.WR两个值都小于10，KDJ3个值平均大于75，EMA为正叉，TRIX交叉数为正，且两个值的差占高值比例不到10%，进行平仓操作
 * 2.WR两个值都小于10，KDJ3个值平均大于75，EMA为正叉，TRIX交叉数为负，进行平仓操作
 * 3.WR两个值都小于10，KDJ3个值平均大于75，EMA为正叉，TRIX交叉数为正，且两个值的差占高值比例大于10%，进行止盈操作
 * 4.WR两个值平均小于15，KDJ3个值平均大于80，EMA为正叉，TRIX交叉数为正，TRIX两值均大于0小于2，进行止盈操作
 * 5.EMA为正叉，TRIX死叉，且TRIX两个值都大于1，KDJ三线死叉，WR两个值均小于35，进行平仓操作
 * @param {} tp
 * @param {} account
 * @return int 0：不需要操作，1：操作止盈，2：操作平仓
 */
function checkNeedTargetProfit(records, emaCrossNum){
	var ret = 0;
	if(emaCrossNum>0){
		var mi = getMainIndicators(records);
		var avgkdj = (mi.K+mi.D+mi.J)/3;
		var avgwr = (mi.WR1+mi.WR2)/2;
		var hour = new Date(records[records.length-1].Time).getHours();
		if(hour == 0){
			if(mi.WR1<10 && mi.WR2<10 && mi.D>60 && avgkdj>75){
				if(mi.TrixCrossNum>0){
					var diffpc = (mi.TRIX-mi.MATRIX)/mi.TRIX;				
					if(diffpc<0.1){
						ret = 2;
					}else{
						ret = 1;
					}
				}else{
					ret = 2;
				}
				if(ret==0 && avgwr<15 && avgkdj<80 && mi.TrixCrossNum>0 && mi.TRIX>0 && mi.MATRIX>0 && mi.TRIX<2 && mi.MATRIX<2){
					ret = 1;
				}
			}
			if(ret==0 && mi.TrixCrossNum<0 && mi.KDJCrossNum<0 && avgwr<35 && mi.TRIX>1 && mi.MATRIX>1){
				ret = 2;
			}
		}else if(hour == 8){
			if(mi.WR1<5 && mi.WR2<5 && mi.D>75 && avgkdj>80){
				if(mi.TrixCrossNum>0){
					var diffpc = (mi.TRIX-mi.MATRIX)/mi.TRIX;				
					if(diffpc<0.1){
						ret = 2;
					}else{
						ret = 1;
					}
				}else{
					ret = 2;
				}
				if(ret==0 && avgwr<10 && avgkdj<85 && mi.TrixCrossNum>0 && mi.TRIX>0 && mi.MATRIX>0 && mi.TRIX<2 && mi.MATRIX<2){
					ret = 1;
				}
			}
			if(ret==0 && mi.TrixCrossNum<0 && mi.KDJCrossNum<0 && avgwr<30 && mi.TRIX>1 && mi.MATRIX>1){
				ret = 2;
			}
		}
	}
	return ret;
}

/**
 * 检测当前是否可以在币价下跌时做短线交易
 * 0.短线操作开关处于手动关闭状态,不做
 * 1.如果当前价处于半年内日线振幅的低位的10%之内，不做
 * 2.如果当前账户余额在账户总价值的10%以内，不做
 * 3.如果当前出现了超跌现像，不做。
 * 4.已经进入正叉不能做。
 * @param {} tp
 */
function checkCanDoSsst(tp, account){
	var ret = true;
	var loc = getInDayLineLocation(tp);
	ssstswitch = _G(tp.Name+"_Ssst_CanDo");
	if(ssstswitch == 0){
		Log("短线交易开闭处于关闭状态，不做短线交易");
		ret = false;
	}else if(ssstswitch == 2 && (loc.Now-loc.Low)/(loc.High-loc.Low) < 0.1){
		Log("当前价处于半年内日线振幅的低位的10%之内，不做短线交易");
		ret = false;
	}else if(ssstswitch == 2 && account.Balance/(account.Balance + _G(tp.Name+"_AvgPrice")*(account.Stocks+account.FrozenStocks)) < 0.1){
		Log("当前账户余额在账户总价值的10%以内，不做短线交易");
		ret = false;
	}else if(_G(tp.Name+"_OverFallBuy")){
		Log("当前日内超跌抄底，还没有回升到理想位置不做短线");
		ret = false;
	}else if(DayLineCrossNum > 0){
		Log("当前处于上升正叉阶段，不做短线交易");
		ret = false;
	}
	return ret;
}

/**
 * 检测当前是否可以在金叉或是超跌的时候加仓
 * 日线金叉的时候：
 * 1.日K线已经金叉，且前当前连续三条阳线
 * 2.当前仓位在80%以下，且当前小于最高币数限制
 * 3.当前价处于半年内日线振幅的低位的5%之内，可以加仓到9成，5~20%之内可以加仓到7成，20~30%之内可以加仓到5成，30~50%之内可以加仓到3成
 * 超跌的时候
 * 1.日线超跌30%，且跌超均价或是持仓不足3成
 * 2.时K线内当前K线超跌超过5成，可以加仓到9万，超过4成可以加仓到7成，超3成可以加仓到5成
 * @param {} tp
 * @return {}
 */
function checkCanBuytoFull(tp){
	var ret = {"type":0,"buyto":0};
	var buyto = 0;
	var loc = getInDayLineLocation(tp);
	var stockvalue = tp.TPInfo.StockValue-tp.TPInfo.TickerLast*tp.Args.MinCoinLimit;
	var position = stockvalue/(tp.TPInfo.Balance+stockvalue);
	if(tp.Args.CanKeepPosition && loc.RecordLength>30 && tp.TPInfo.TickerLast < _G(tp.Name+"_BuyGuidePrice")){
		var nowloc = (loc.Now-loc.Low)/(loc.High-loc.Low);
		var pc = 0.6;
		if(DayLineCrossNum < 0 && position > pc/2){
			if(nowloc <= 0.01 && position < (pc+0.2)){
				buyto = (pc+0.2);
			}else if(nowloc > 0.01 && nowloc <= 0.06 && position < (pc+0.1)){
				buyto = (pc+0.1);
			}else if(nowloc > 0.06 && nowloc <= 0.1 && position < pc){
				buyto = pc;
			}
			//半年的振幅小于2那么保仓值要减半，震荡幅度不够，下跌深底不够
			if(loc.High/loc.Low < 2){
				buyto = buyto/2;
			}
			if(position > buyto/2 && (buyto - position) > 0.01 ){
				Log("满足日K线创年半内新低之后加仓到",buyto*100,"%的条件，可以操作买入");
			}else{
				buyto = 0;
			}
		}else if(DayLineCrossNum == 1 || DayLineCrossNum == 2){
			if(loc.LastRecord.Close > loc.LastRecord.Open && loc.SecondRecord.Close > loc.SecondRecord.Open && loc.ThirdRecord.Close > loc.ThirdRecord.Open && tp.TPInfo.Stocks < tp.Args.MaxCoinLimit){
				//获得交叉点的七线价
				var records = GetRecords(tp,PERIOD_D1);
				var line7 = TA.EMA(records, 7);
				var xprice = line7[line7.length - DayLineCrossNum];
				//判断7线价的位置
				nowloc = (xprice-loc.Low)/(loc.High-loc.Low);
				if(nowloc <= 0.10 && position < (pc+0.3)){
					buyto = (pc+0.3);
				}else if(nowloc > 0.10 && nowloc <= 0.15 && position < (pc+0.2)){
					buyto = (pc+0.2);
				}else if(nowloc > 0.15 && nowloc <= 0.20 && position < (pc+0.1)){
					buyto = (pc+0.1);
				}else if(nowloc > 0.20 && nowloc <= 0.25 && position < pc){
					buyto = pc;
				}else if(nowloc > 0.25 && nowloc <= 0.50 && tp.TPInfo.TickerLast < _G(tp.Name+"_BuyGuidePrice") && position < 0.8){
					pc = position*(_G(tp.Name+"_BuyGuidePrice")/_G(tp.Name+"_AvgPrice"));
					if(pc > position){
						if(pc > 0.8){
							buyto = 0.8;
						}else{
							buyto = pc;
						}
					}
				}
				if(buyto){
					Log("满足日K线金叉之后加仓到",buyto*100,"%的条件，可以操作买入");
				}
			}
		}
	}
	//需要买入，设置返回对像
	if(buyto > 0){
		ret = {"type":1,"buyto":buyto};
	}else{
		if(loc.SecondRecord.High/loc.LastRecord.Close >= 1.15 && tp.TPInfo.Stocks < tp.Args.MaxCoinLimit){
			//日线超跌15%以上，如果发生短时内，可以进行抄底买入
			var records = GetRecords(tp,PERIOD_H1);
			var lastrecord = records[records.length - 1];
			var secondrecord = records[records.length - 2];
			if(!secondrecord) secondrecord = lastrecord;
			var downpc = secondrecord.High/lastrecord.Close;
			var msg = "";
			if(downpc >= 1.7 && position < 0.9){
				msg = "满足时K线跌超70%";
				buyto = 0.9;
			}else if(downpc >= 1.6 && position < 0.8){
				msg = "满足时K线跌超60%";
				buyto = 0.8;
			}else if(downpc >= 1.5 && position < 0.7){
				msg = "满足时K线跌超50%";
				buyto = 0.7;
			}else if(downpc >= 1.4 && position < 0.6){
				msg = "满足时K线跌超40%";
				buyto = 0.6;
			}else if(downpc >= 1.3 && position < 0.5){
				msg = "满足时K线跌超30%";
				buyto = 0.5;
			}else if(downpc >= 1.2 && position < 0.2){
				msg = "满足时K线跌超20%";
				buyto = 0.2;
			}else if(downpc >= 1.15 && position < 0.15){
				msg = "满足时K线跌超15%";
				buyto = 0.15;
			}
			if(downpc >= 1.15 && !_G(tp.Name+"_OverFallBuy") && buyto == 0 && position<0.9){
				msg="满足时K线跌超"+_N((downpc-1)*100,2)+"%";
				buyto = position+0.1;
			}
			//需要买入，设置返回对像
			if(buyto > 0){
				if(loc.SecondRecord.Close < _G(tp.Name+"_AvgPrice") && loc.SecondRecord.Close < _G(tp.Name+"_BuyGuidePrice")) buyto = buyto*1.5;
				if(buyto > 0.9) buyto = 0.9;
				if(position < 0.9){
					Log(msg,"加仓到",buyto,"%的条件，可以操作买入");
				}
				ret = {"type":2,"buyto":buyto};
			}
		}
	}
	return ret;
}


//在金叉的时候取消所有短线交易卖出挂单
function cancelAllSsstSellOrder(tp, beforeBuyingStocks){
	//检测当前是否存在短线交易
	if(tp.Sssts.length ){
		//存在，检测当前卖单交易是否完成,没有完成强制取消挂单
		checkSsstSellFinish(tp, true);
		//对未完成的卖单计入长线核算
		var Amount = 0;
		var BuyPrice = tp.Sssts[0].BuyPrice;
		for(var i=0;i<tp.Sssts.length;i++){
			if(tp.Sssts[i].Type == 1) Amount += tp.Sssts[i].Amount;
		}
		if(Amount){
			Log(tp.Title,"交易对金叉时发现存在未完成短线交易卖出挂单，现将其未完成的量",Amount,"按",BuyPrice,"买入计入长线核算。");
			//有挂单没有完成，将挂单数量和金额计入持仓均价
			var coinAmount = beforeBuyingStocks + Amount;
			//计算持仓总价
			var avgPrice = _G(tp.Name+"_AvgPrice");
			var Total = parseFloat((avgPrice*beforeBuyingStocks + BuyPrice * Amount*(1+tp.Args.BuyFee)).toFixed(tp.Args.PriceDecimalPlace));
			
			//计算并调整平均价格
			avgPrice = parseFloat((Total / coinAmount).toFixed(tp.Args.PriceDecimalPlace));
			_G(tp.Name+"_AvgPrice",avgPrice);
			
			Log(tp.Title,"交易对先前的短线交易挂单买入价：",BuyPrice,"，未卖出数量：",Amount,"，长线持仓价格调整到：",avgPrice,"，总持仓数量：",coinAmount,"，总持币成本：",Total);			
			
			//保存每次买入之后币的数量
			_G(tp.Name+"_lastBuycoinAmount", coinAmount);

			//找出买入挂单，去除卖出挂单
			var newsssts = [];
			for(var i=0;i<tp.Sssts.length;i++){
				if(tp.Sssts[i].Type == 2) newsssts.push(tp.Sssts[i]);
			}
			tp.Sssts = newsssts;
		}
	}
}

//在死叉的时候取消所有短线交易买入挂单
function cancelAllSsstBuyOrder(tp){
	//检测当前是否存在短线交易
	if(tp.Sssts.length ){
		//存在，检测当前买单交易是否完成,没有完成强制取消挂单
		Log(tp.Title,"交易对死叉时存在短线交易买入挂单，现检测当前交易是否完成,没有完成强制取消挂单。");
		//再次取消所有依然存在的挂单,包括买单
		for(var i=0;i<tp.Sssts.length;i++){
			if(tp.Sssts[i].Type == 2 && tp.Sssts[i].OrderID) tp.Exchange.CancelOrder(tp.Sssts[i].OrderID);
		}
	}
	
	//清空原来的挂单数组内容
	tp.Sssts = [];
}


//定时任务，主业务流程 
function onTick(tp) {
	var debug = _G(tp.Name+"_Debug") == "1" ? true : false;
	//获取实时信息
	var Account = GetAccount(tp);
    var Ticker = GetTicker(tp);
	
	//检测上一个订单，成功就改状态，不成功就取消重新发
	if(_G(tp.Name+"_LastOrderId") && _G(tp.Name+"_OperatingStatus") != OPERATE_STATUS_NONE){
		var ret = false;
		if(_G(tp.Name+"_OperatingStatus") > OPERATE_STATUS_BUY){
			ret = checkSellFinish(tp,Account);
		}else{
			ret = checkBuyFinish(tp,Account);
		}
		if(ret){
			//刚才上一次订单ID清空，不再重复判断
			_G(tp.Name+"_LastOrderId",0);
			//重置操作状态
			_G(tp.Name+"_OperatingStatus", OPERATE_STATUS_NONE);
		}else{
			return;
		}
	}

    //定义并初始化其他变量
	var stockValue = parseFloat((Account.Stocks*Ticker.Last).toFixed(tp.Args.PriceDecimalPlace));
	if(debug) Log("账户余额", parseFloat(Account.Balance).toFixed(8), "，可用币数", parseFloat(Account.Stocks).toFixed(8), "，冻结币数", parseFloat(Account.FrozenStocks).toFixed(8) , "，当前持币价值", stockValue);
	//获取当前均价
	var avgPrice = _G(tp.Name+"_AvgPrice");
	if(!avgPrice){
		//平均价格为空或0，说明新启动，尝试从参数读入并写入存储
		avgPrice = tp.Args.NowCoinPrice;
		_G(tp.Name+"_AvgPrice",avgPrice);
	}
	//处理持仓价格变量
    var coinAmount = getAccountStocks(Account); //从帐户中获取当前持仓信息
	if(coinAmount > tp.Args.TradeLimits.MPOMinSellAmount && avgPrice === 0){
		Log(tp.Title+"交易对账户有持币，但是输入的均价为0，请确认参数！！ #FF0000");
		return false;
	}
	var buyDynamicPoint = _G(tp.Name+"_BuyDynamicPoint");	
	var sellDynamicPoint = _G(tp.Name+"_SellDynamicPoint");
    var lastBuyPrice = _G(tp.Name+"_LastBuyPrice");
    var lastSellPrice = _G(tp.Name+"_LastSellPrice");
	var historyHighPoint = _G(tp.Name+"_HistoryHighPoint");
	var overFallBuy = _G(tp.Name+"_OverFallBuy");
	var viaGoldArea = _G(tp.Name+"_ViaGoldArea");
	var operateFineness = _G(tp.Name+"_OperateFineness");
    var costTotal = parseFloat((avgPrice*coinAmount).toFixed(tp.Args.PriceDecimalPlace));	//从帐户中获取当前持仓信息和平均价格算出来
	var opAmount = 0;
    var orderid = 0;
	var isOperated = false;	
	if(debug) Log("当前持仓均价", avgPrice, "，持币数量", _N(coinAmount,tp.Args.StockDecimalPlace), "，上一次买入", lastBuyPrice, "，上一次卖出", lastSellPrice, "，总持币成本", costTotal);

	//收集当前交易对信息
	var tpInfo = {
		Balance:Account.Balance,	//余额
		FrozenBalance:Account.FrozenBalance,	//冻结余额
		Stocks:Account.Stocks,	//可用币数
		FrozenStocks:Account.FrozenStocks,	//冻结币数
		AvgPrice:avgPrice,	//持仓均价
		CostTotal:costTotal,	//持仓成本
		TickerLast:Ticker.Last,	//当前币价
		StockValue:stockValue,	//持币价值
		LastBuyPrice:lastBuyPrice,	//上一次买入
		LastSellPrice:lastSellPrice,	//上一次卖出
		BuyDynamicPoint:buyDynamicPoint,	//动态买入点
		SellDynamicPoint:sellDynamicPoint	//动态卖出点
	};
	tp.TPInfo = tpInfo; 

	//获取行情数据
    DayLineCrossNum = Cross(tp, PERIOD_D1, 7, 21);
    if (DayLineCrossNum > 0) {
        if(debug) Log("当前交叉数为", DayLineCrossNum, ",处于上升通道");
		//调整买入后的量高价格
		if(Ticker.Buy > historyHighPoint){
			historyHighPoint = Ticker.Buy;
			_G(tp.Name+"_HistoryHighPoint", historyHighPoint);
		}
		//取消现有的短线卖出挂单
		if(DayLineCrossNum == 1 || DayLineCrossNum == 2){
			cancelAllSsstSellOrder(tp, coinAmount);
		}
		//如果超过2，就更改通过金叉标识
		if(DayLineCrossNum >= 2 && !viaGoldArea){
			if(debug) Log("更改通过金叉标识为1");
			viaGoldArea = 1;
			_G(tp.Name+"_ViaGoldArea", viaGoldArea);
		}
    } else {
        if(debug) Log("当前交叉数为", DayLineCrossNum, ",处于下降通道");
		//取消现有的短线买入挂单
		if(DayLineCrossNum == -1 || DayLineCrossNum == -2){
			cancelAllSsstBuyOrder(tp)
		}
        //如果超过-2，就更改通过金叉标识
        if(viaGoldArea && (DayLineCrossNum >= -2 && coinAmount <= tp.Args.MinCoinLimit+tp.Args.TradeLimits.MPOMinSellAmount*2 || DayLineCrossNum <= -3)){
			if(debug) Log("更改通过金叉标识为0");
			viaGoldArea = 0;
			_G(tp.Name+"_ViaGoldArea", viaGoldArea);
		}
    }
    var baseBuyPrice = lastBuyPrice ? lastBuyPrice : avgPrice;
    var baseSellPrice = lastSellPrice ? lastSellPrice : avgPrice;
    if(debug) Log("当前基准买入价格=", baseBuyPrice, "，当前基准卖出价格=", baseSellPrice, "，动态买入点", buyDynamicPoint, "，动态买出点", sellDynamicPoint, "，当前币价", Ticker.Sell);
	//优选做快速买卖的决策判断
    var buytofull = checkCanBuytoFull(tp);
	if(buytofull.buyto > 0){
		var canpay = (tp.Args.MaxCoinLimit - coinAmount) * Ticker.Sell;
		if(Account.Balance < canpay){
			canpay = Account.Balance;
		}
		var mincoinlimitvalue = tp.Args.MinCoinLimit*Ticker.Last;
		var mustpay =  (stockValue - mincoinlimitvalue + Account.Balance) * buytofull.buyto - (stockValue - mincoinlimitvalue);
		if(canpay < mustpay){
			mustpay = canpay;
		}
		if(tp.Args.TradeLimits.MPOMaxBuyAmount < mustpay){
			mustpay = tp.Args.TradeLimits.MPOMaxBuyAmount;
		}
		if(mustpay > tp.Args.TradeLimits.MPOMinBuyAmount){
			mustpay = _N(mustpay, tp.Args.PriceDecimalPlace);
			Log(tp.Title+"交易对当前需要快速操作买入加仓到", buytofull.buyto,"，预计花费",mustpay);
			isOperated = true;
			tp.Exchange.SetPrecision(tp.Args.PriceDecimalPlace, tp.Args.PriceDecimalPlace);
			orderid = tp.Exchange.Buy(-1,mustpay);
			_G(tp.Name+"_OperatingStatus",OPERATE_STATUS_BUY);
			_G(tp.Name+"_BeforeBuyingStocks",coinAmount);
			//如果是超跌抄底，需要设置标识保存之前的买入量
			if(buytofull.type == 2){
				if(!overFallBuy){
					_G(tp.Name+"_OverFallBuy",1);
					_G(tp.Name+"_OverFallBefore",coinAmount);
				}
				_G(tp.Name+"_OverFallLastBuy",new Date().getTime());
				var costs = _G(tp.Name+"_OverFallCosts") ? _G(tp.Name+"_OverFallCosts") : 0;
				costs += mustpay;
				_G(tp.Name+"_OverFallCosts",costs);
			}
		}else{
			Log(tp.Title+"交易对可支付金额不足于购买最小交易量，保仓操作完成。");
		}
	}
	if(!orderid){
		//如果当前K线发生了超过30%的超跌抄底，根据情况决定是否要操作平仓
		if(overFallBuy){
			var hourrecords = GetRecords(tp, PERIOD_H1);
			var lastrecord = hourrecords[hourrecords.length -1];
			var secondrecord = hourrecords[hourrecords.length -2];
			if(!secondrecord) secondrecord = lastrecord;
			var overfallbefore = _G(tp.Name+"_OverFallBefore") ? _G(tp.Name+"_OverFallBefore") : 0;
			var cansell = coinAmount - overfallbefore;
			if(cansell > tp.Args.TradeLimits.MPOMinSellAmount){
				if(debug) Log(tp.Title+"交易对发生了超跌抄底，抄底买入数量", cansell);
				var now = getTimestamp();
				if(coinAmount > overfallbefore && Ticker.Buy/avgPrice > 1.02 && (lastrecord.High/lastrecord.Low > 1.15 && (lastrecord.Close - lastrecord.Low)/(lastrecord.High - lastrecord.Low) > 0.8 || secondrecord.High/secondrecord.Low > 1.15 && (lastrecord.Close - secondrecord.Low)/(secondrecord.High - secondrecord.Low) > 0.8 || now > _G(tp.Name+"_OverFallLastBuy")+3600000)){
					//判断回升之后要不要平仓
					var exit = true;
					//取得抄底买入的平均价
					var avgp = _G(tp.Name+"_OverFallCosts")/cansell;
					var loc = getInDayLineLocation(tp);
					var nowloc = (avgp-loc.Low)/(loc.High-loc.Low);
					if(nowloc < 0.1){
						//处于历史低位的抄底不平仓
						exit = false;
					}else if(avgp < avgPrice && avgPrice < _G(tp.Name+"_BuyGuidePrice") && coinAmount > tp.Args.MinCoinLimit+tp.Args.TradeLimits.MPOMinSellAmount){
						//抄底平均价小于平均持仓价不平仓
						exit = false;
					}else{
						if(Ticker.Buy < _G(tp.Name+"_BuyGuidePrice")){
							//回升后的当前价低于买入指导价的超跌抄底不平仓
							exit = false;
						}
					}
					//根据是否平仓做处理
					if(exit){
						opAmount = cansell;
						if(tp.Args.TradeLimits.MPOMaxSellAmount < opAmount){
							opAmount = tp.Args.TradeLimits.MPOMaxSellAmount;
						}
						isOperated = true;
						Log(tp.Title+"交易对超跌抄底买入了",cansell,"个币，抄底价格不具有持仓优势，当前回升超过8成，操作平仓");
						tp.Exchange.SetPrecision(tp.Args.PriceDecimalPlace, tp.Args.StockDecimalPlace);
						orderid = tp.Exchange.Sell(-1, opAmount);
						_G(tp.Name+"_OperatingStatus",OPERATE_STATUS_SELL);
					}else{
						Log(tp.Title+"交易对在超跌抄底买入了",cansell,"个币，抄底价格具有持仓优势，当前回升超过8成，继续持仓");
						_G(tp.Name+"_lastBuycoinAmount", coinAmount);
						_G(tp.Name+"_OverFallBuy",0);
						_G(tp.Name+"_OverFallBefore",null);
						_G(tp.Name+"_OverFallCosts",null);
					}
				}
			}else{
				//已经平仓完成，要清除标识
				Log(tp.Title+"交易对已经完成了超跌抄底的平仓工作。");
				_G(tp.Name+"_OverFallBuy",0);
				_G(tp.Name+"_OverFallBefore",null);
				_G(tp.Name+"_OverFallCosts",null);
			}
		}
		if(!orderid){
			//再来做慢节奏的行情判断
		    if (DayLineCrossNum < 0 && Account.Balance > tp.Args.TradeLimits.MPOMinBuyAmount && (baseBuyPrice === 0 || Ticker.Sell < baseBuyPrice * (1 - buyDynamicPoint - tp.Args.BuyFee))) {
				if(coinAmount <= tp.Args.MaxCoinLimit){
					//判断当前余额下可买入数量
					var canpay = (tp.Args.MaxCoinLimit - coinAmount) * Ticker.Sell;
					if(Account.Balance < canpay){
						canpay = Account.Balance;
					}
					var canbuy = canpay/Ticker.Sell;
					var operatefineness = buyDynamicPoint == tp.Args.BuyPoint ? operateFineness : operateFineness*(1+(avgPrice-Ticker.Sell)/avgPrice*buyDynamicPoint*100);
					opAmount = canbuy > operatefineness? operatefineness : canbuy;
					var buyfee = _N(opAmount*Ticker.Sell, tp.Args.PriceDecimalPlace);
					if(tp.Args.TradeLimits.MPOMaxBuyAmount < buyfee){
						buyfee = tp.Args.TradeLimits.MPOMaxBuyAmount;
						opAmount = buyfee/Ticker.Sell;
					}
					if(buyfee > tp.Args.TradeLimits.MPOMinBuyAmount){
						if(coinAmount <= tp.Args.TradeLimits.MPOMinSellAmount || baseBuyPrice === 0){
							if(debug) Log("程序运行之后或卖空之后第一次买入，以现价", Ticker.Sell, "，准备买入",opAmount,"个币。");
						}else{
							if(debug) Log("当前市价", Ticker.Sell, " < 买入价位", parseFloat((baseBuyPrice * (1 - buyDynamicPoint - tp.Args.BuyFee)).toFixed(tp.Args.PriceDecimalPlace)), "，准备买入",opAmount,"个币。");
						}
						isOperated = true;
						Log("当前基准买入价格", baseBuyPrice, "上次买入价格", lastBuyPrice, "动态买入点", buyDynamicPoint, "当前持仓总量", coinAmount);
						Log(tp.Title+"交易对准备以",Ticker.Sell,"的价格买入",opAmount,"个币，当前账户余额为：",Account.Balance,"。本次下单金额",buyfee,"，本次预期买入数量",opAmount,"，预期成交价格",Ticker.Sell); 
						tp.Exchange.SetPrecision(tp.Args.PriceDecimalPlace, tp.Args.PriceDecimalPlace);
						orderid = tp.Exchange.Buy(-1,buyfee);
						_G(tp.Name+"_OperatingStatus",OPERATE_STATUS_BUY);
						_G(tp.Name+"_BeforeBuyingStocks",coinAmount);
					}
				}else{
					if(debug) Log("当前持仓数量已经达到最大持仓量", tp.Args.MaxCoinLimit, "，不再买入，看机会卖出。");
				}
		    }
		    if(!orderid){
		    	if(coinAmount > tp.Args.MinCoinLimit+tp.Args.TradeLimits.MPOMinSellAmount && Ticker.Buy > avgPrice){
			    	//检测技术指标看是否需要技术性止盈或平仓
			    	var ntp = checkNeedTargetProfit(GetRecords(tp, PERIOD_D1), DayLineCrossNum);
			    	if(ntp == 1){
			    		//技术性止盈1个小时操作一次
			    		var now = getTimestamp();
			    		var lasttp = _G(tp.Name+"_LastTP");
			    		if(lasttp && now < (lasttp + 21600000)){
			    			ntp = 0;
			    			Log("上次技术指标止盈操作还没有6个小时，本次暂不操作");
			    		}
			    	}
					if((DayLineCrossNum > 0 || overFallBuy) && Ticker.Buy > _G(tp.Name+"_BuyGuidePrice") && (ntp || (Ticker.Buy > baseSellPrice * (1 + sellDynamicPoint + tp.Args.SellFee))) || viaGoldArea && (DayLineCrossNum === -1 || DayLineCrossNum === -2)) {
				    	var dosell = true;
				    	if(DayLineCrossNum < 0){
				    		Log("进入了死叉，对现有获利盘持仓进行平仓。");
				    	}else{
					    	if(Ticker.Buy < historyHighPoint*0.85){
					    		var handledRetreat = _G(tp.Name+"_HandledRetreat") ? _G(tp.Name+"_HandledRetreat") : 0;
					    		if(handledRetreat > 0){
					    			//直接不做
					    			dosell = false;
					    		}else{
					    			//判断是否发生了短时超跌
						    		var hourrecords = GetRecords(tp, PERIOD_H1);
									var lastrecord = hourrecords[hourrecords.length -1];
									if(lastrecord.Open/lastrecord.Close > 1.15){
										sellDynamicPoint = sellDynamicPoint/4;
										if(sellDynamicPoint < 0.05) sellDynamicPoint = 0.05;
										_G(tp.Name+"_SellDynamicPoint", sellDynamicPoint);				    			
										if(Ticker.Buy < lastSellPrice) _G(tp.Name+"_LastSellPrice", Ticker.Buy);
										Log("在超过60%浮盈后币价出现了一小时内超过15%的回撤，进入超跌行情，暂时仅下调卖出指导价和动态卖出点不卖出");
										dosell = false;
										//标识已经处理超跌回撤
										_G(tp.Name+"_HandledRetreat", 2);
									}else{
						    			//还没有处理，开始开仓止盈
						    			Log("在超过60%浮盈后币价出现了超过15%的回撤,操作开仓止盈。");
						    			if((coinAmount-tp.Args.MinCoinLimit) <= _G(tp.Name+"_lastBuycoinAmount")*0.4){
							    			sellDynamicPoint = sellDynamicPoint/2;
							    			if(sellDynamicPoint < 0.05) sellDynamicPoint = 0.05;
							    			_G(tp.Name+"_SellDynamicPoint", sellDynamicPoint);
							    			Log("在超过60%浮盈后币价出现了超过15%的回撤，减仓到4成并调整动态卖出点减半，期望余下的40%的仓位还可以卖个好价");
											dosell = false;
											//标识已经处理非超跌回撤
											_G(tp.Name+"_HandledRetreat", 1);
							    		}else{
											//标识正在处理非超跌回撤
											_G(tp.Name+"_HandledRetreat", -1);
							    		}
									}
					    		}
					    	}
				    	}
				    	if(dosell){
							var operatefineness = sellDynamicPoint == tp.Args.SellPoint ? operateFineness : operateFineness*(1+(Ticker.Buy-avgPrice)/avgPrice);
							opAmount = (coinAmount - tp.Args.MinCoinLimit) > operatefineness? operatefineness : _N((coinAmount - tp.Args.MinCoinLimit),tp.Args.StockDecimalPlace);
							if(tp.Args.TradeLimits.MPOMaxSellAmount < opAmount){
								opAmount = tp.Args.TradeLimits.MPOMaxSellAmount;
							}
							if(coinAmount > tp.Args.MinCoinLimit && opAmount > tp.Args.TradeLimits.MPOMinSellAmount){
								if(debug) Log("当前市价", Ticker.Buy, " > 卖出点", parseFloat((baseSellPrice * (1 + tp.Args.SellPoint + tp.Args.SellFee)).toFixed(tp.Args.PriceDecimalPlace)), "，准备卖出",opAmount,"个币");
								isOperated = true;
								Log(tp.Title+"交易对准备以大约",Ticker.Buy,"的价格卖出",opAmount,"个币，当前持仓总量",coinAmount, "动态卖出点", sellDynamicPoint, "基准卖出价", baseSellPrice);
								tp.Exchange.SetPrecision(tp.Args.PriceDecimalPlace, tp.Args.StockDecimalPlace);
								orderid = tp.Exchange.Sell(-1, opAmount);
								_G(tp.Name+"_OperatingStatus",OPERATE_STATUS_SELL);
							}else{
								if(debug) Log("当前持仓数量小于最小持仓量", tp.Args.MinCoinLimit, "，没有币可卖，看机会再买入。");
							}
				    	}
				    	//更新技术指标止盈时间点
				    	if(orderid && ntp == 1) _G(tp.Name+"_LastTP", getTimestamp());
				    }
		    	}
			    if(!orderid){
					if (DayLineCrossNum < 0 ){
						if(debug) Log("价格没有下跌到买入点，继续观察行情...");
						//当买入指导价为0时,看是否有必要操作买入指导价的重置，以增强买入活跃度
				    	if(lastBuyPrice == 0 && lastSellPrice > 0){
				    		//当前持仓量小于可卖仓量（最后买入持仓量-最小持仓量）的40%和价格已经回落到了上次卖出价头寸的4成，调整买入指导价为当前价格，以方便可以在相对合理的价格就开始开仓补货，这样可以抬高持仓均价，不至于一次遇到市场最低点之后以后再无法买入了
				    		var lastBuycoinAmount = _G(tp.Name+"_lastBuycoinAmount") ? _G(tp.Name+"_lastBuycoinAmount") : 0;
				    		if(stockValue/Account.Balance < 0.4 && coinAmount/lastBuycoinAmount < 0.4 && (Ticker.Sell-avgPrice)/(lastSellPrice-avgPrice) < 0.4){
				    			_G(tp.Name+"_LastBuyPrice", Ticker.Sell);
				    			_G(tp.Name+"_BuyGuidePrice",Ticker.Sell);
				    			if(debug) Log("且当前持仓量小于可卖仓量（最后买入持仓量-最小持仓量）的40%和价格已经回落到了上次卖出价头寸的4成，调整买入指导价为当前价格，以方便可以在相对合理的价格就开始开仓补货。");
				    		}
				    	}
					}else{
						if(debug) Log("价格没有上涨到卖出点，继续观察行情...");
					}
					//调整买入指导价，使其更合理
					if(lastBuyPrice > 0 && lastSellPrice == 0 && coinAmount<=tp.Args.MinCoinLimit+tp.Args.TradeLimits.MPOMinSellAmount){
			    		var loc = getInDayLineLocation(tp);
						var goodbuyprice = (loc.High+loc.Low)/2;
						if(lastBuyPrice > goodbuyprice){
							_G(tp.Name+"_LastBuyPrice", goodbuyprice);
							_G(tp.Name+"_BuyGuidePrice",goodbuyprice);
							Log("当前已经完成平仓，但最后的持仓均价过高，适当降底买入指导价以减小未来买入成本。从",lastBuyPrice,"调到",goodbuyprice);
							//重新计算操作粒度
							if(exchanges.length == 1) _G(tp.Name+"_OperateFineness", parseFloat((Account.Balance/goodbuyprice/Transaction_Depth).toFixed(tp.Args.StockDecimalPlace)));
						}else if(DayLineCrossNum > 0 && avgPrice < Ticker.Sell){
							var guidebuyprice = (Ticker.Sell+avgPrice)/2;
							if(guidebuyprice > lastBuyPrice && guidebuyprice <= goodbuyprice){
								_G(tp.Name+"_LastBuyPrice", guidebuyprice);
								_G(tp.Name+"_BuyGuidePrice",guidebuyprice);
								Log("当前已经完成平仓，但币价继续上升，适当调整买入指导价以防止指导价过低无法买入。从",lastBuyPrice,"调到",guidebuyprice);
								//重新计算操作粒度
								if(exchanges.length == 1) _G(tp.Name+"_OperateFineness", parseFloat((Account.Balance/guidebuyprice/Transaction_Depth).toFixed(tp.Args.StockDecimalPlace)));
							}
				    	}
			    	}
			    }
		    }
    	}
    }
    //判断并输出操作结果
	if(isOperated){
		if (orderid) {
			_G(tp.Name+"_LastOrderId",orderid);
			if(debug) Log("订单发送成功，订单编号：",orderid);
		}else{
			_G(tp.Name+"_OperatingStatus",OPERATE_STATUS_NONE);
			if(debug) Log("订单发送失败，取消正在操作状态");
		}
	}
	return true;
}

//处理状态的显示
function showStatus(nowtp){
	TickTimes++;
	//显示参数信息
	if(!ArgTables){
		var argtables = [];
		for(var i=0;i<TradePairs.length;i++){
			var tp = TradePairs[i];
			var table = {};
			table.type="table";
			table.title = tp.Title;
			table.cols = ['参数', '参数名称', '值'];
			var rows = [];
			rows.push(['MaxCoinLimit','最大持仓量', tp.Args.MaxCoinLimit]);		
			rows.push(['MinCoinLimit','最小持仓量', tp.Args.MinCoinLimit]);		
			rows.push(['OperateFineness','买卖操作的粒度', tp.Args.OperateFineness]);		
			rows.push(['NowCoinPrice','当前持仓平均价格/指导买入价格', tp.Args.NowCoinPrice]);		
			rows.push(['BuyFee','平台买入手续费', tp.Args.BuyFee]);		
			rows.push(['SellFee','平台卖出手续费', tp.Args.SellFee]);		
			rows.push(['PriceDecimalPlace','交易对价格小数位', tp.Args.PriceDecimalPlace]);		
			rows.push(['StockDecimalPlace','交易对数量小数位', tp.Args.StockDecimalPlace]);		
			rows.push(['BuyPoint','基准买入点', tp.Args.BuyPoint]);		
			rows.push(['AddPointInBuy','动态买入加点', tp.Args.AddPointInBuy]);		
			rows.push(['SellPoint','基准卖出点', tp.Args.SellPoint]);		
			rows.push(['AddPointInSell','动态卖出加点', tp.Args.AddPointInSell]);		
			rows.push(['CanKeepPosition','是否允许在金叉保仓', ['不允许','允许'][tp.Args.CanKeepPosition]]);		
			rows.push(['HistoryHighPoint','半年历史高点', tp.Args.HistoryHighPoint]);		
			rows.push(['HistoryLowPoint','半历史低点', tp.Args.HistoryLowPoint]);		
			rows.push(['TradeLimits','限价单交易限额', '最小交易量：'+tp.Args.TradeLimits.LPOMinAmount+'，最大交易量：'+tp.Args.TradeLimits.LPOMaxAmount]);		
			rows.push(['','市价单交易限额', '最小买入量：'+tp.Args.TradeLimits.MPOMinBuyAmount+'，最大买入量：'+tp.Args.TradeLimits.MPOMaxBuyAmount+'，最小卖出量：'+tp.Args.TradeLimits.MPOMinSellAmount+'，最大卖出量：'+tp.Args.TradeLimits.MPOMaxSellAmount]);		
			table.rows = rows;
			argtables.push(table);
		}
		ArgTables = argtables;
	}		

	//显示帐户信息
	if(!AccountTables){
		var accounttables = [];
		var accounttable1 = {};
		accounttable1.type="table";
		accounttable1.title = "价格信息";
		accounttable1.cols = ['交易对','账户余额','冻结币数','长线持仓量','持仓均价','持仓成本','当前币价','持币价值','上次买入价','上次卖出价','买入点','卖出点'];
		var rows = [];
		for(var r=0;r<TradePairs.length;r++){
			var tp = TradePairs[r];
			var i = tp.TPInfo;
			rows.push([tp.Title, parseFloat(i.Balance).toFixed(8), parseFloat((i.FrozenStocks+0).toFixed(8)), parseFloat((i.Stocks+0).toFixed(8)), i.AvgPrice, i.CostTotal, 
			i.TickerLast, i.StockValue,  parseFloat(i.LastBuyPrice).toFixed(tp.Args.PriceDecimalPlace),  parseFloat(i.LastSellPrice).toFixed(tp.Args.PriceDecimalPlace),(i.BuyDynamicPoint+0).toFixed(3),(i.SellDynamicPoint+0).toFixed(3)]);
		}
		accounttable1.rows = rows;
		accounttables.push(accounttable1);
		var accounttable2 = {};
		accounttable2.type="table";
		accounttable2.title = "状态信息";
		accounttable2.cols = ['交易对','买入次数','卖出次数','总交易次数','累计收益','调试','短线交易','操作粒度','买入指导价','添加时间','最后更新'];
		rows = [];
		for(var r=0;r<TradePairs.length;r++){
			var tp = TradePairs[r];
			rows.push([tp.Title, _G(tp.Name+"_BuyTimes"), _G(tp.Name+"_SellTimes"), (_G(tp.Name+"_BuyTimes")+_G(tp.Name+"_SellTimes")), parseFloat(_G(tp.Name+"_SubProfit")).toFixed(tp.Args.PriceDecimalPlace), _G(tp.Name+"_Debug"), ['关闭','打开','自动'][_G(tp.Name+"_Ssst_CanDo")], _G(tp.Name+"_OperateFineness"), _G(tp.Name+"_BuyGuidePrice"), _G(tp.Name+"_AddTime"), tp.LastUpdate]);
		}
		accounttable2.rows = rows;
		accounttables.push(accounttable2);
		var accounttable3 = {};
		accounttable3.type="table";
		accounttable3.title = "短线交易挂单";
		accounttable3.cols = ['交易对','档次','交易类型','买入价','卖出价','当前币价','交易量','订单编号','挂单时间'];
		rows = [];
		for(var r=0;r<TradePairs.length;r++){
			var tp = TradePairs[r];
			for(var i = 0;i<THRID_ORDERY_LEVELS.length;i++){
				rows.push([tp.Title, THRID_ORDERY_LEVELS[i], '-', '-', '-', '-', '-', '-', '-']);
			}
		}
		accounttable3.rows = rows;
		accounttables.push(accounttable3);
		var accounttable4 = {};
		accounttable4.type="table";
		accounttable4.title = "当前MO交易挂单";
		accounttable4.cols = ['交易对','订单编号','交易类型','买入价','卖出价','当前币价','交易量','完成量','挂单时间'];
		rows = [];
		if(TpMOOrders && TpMOOrders.length){
			for(var r=0;r<TpMOOrders.length;r++){
				rows.push(TpMOOrders[r].split("|"));
			}
		}
		accounttable4.rows = rows;
		accounttables.push(accounttable4);
		var accounttable5 = {};
		accounttable5.type="table";
		accounttable5.title = "条件操作命令";
		accounttable5.cols = ['编号','条件','命令','操作内容','提交时间'];
		rows = [];
		var ConditionCmds = _G("ConditionCmds");
		if(!ConditionCmds) ConditionCmds = []; 
		for(var r=0;r<ConditionCmds.length;r++){
			var cmds = ConditionCmds[r].split("|");
			var cmd = "";
			for(var l=3;l<cmds.length;l++){
				if(l == 3){
					cmd = cmds[l];
				}else{
					cmd += "|"+cmds[l];
				}
			}
			rows.push([cmds[0],cmds[1],cmds[2],cmd,_D(parseInt(cmds[0]))]);
		}
		accounttable5.rows = rows;
		accounttables.push(accounttable5);
		AccountTables = accounttables;
	}else{
		var accounttable1 = AccountTables[0];
		for(var r=0;r<accounttable1.rows.length;r++){
			if(nowtp.Title == accounttable1.rows[r][0]){
				var i = nowtp.TPInfo;
				accounttable1.rows[r] =[nowtp.Title, parseFloat(i.Balance).toFixed(8), parseFloat((i.FrozenStocks+0).toFixed(8)), parseFloat((i.Stocks+0).toFixed(8)), i.AvgPrice, i.CostTotal, 
				i.TickerLast, i.StockValue,  parseFloat(i.LastBuyPrice).toFixed(nowtp.Args.PriceDecimalPlace), parseFloat(i.LastSellPrice).toFixed(nowtp.Args.PriceDecimalPlace),(i.BuyDynamicPoint+0).toFixed(3),(i.SellDynamicPoint+0).toFixed(3)];
				break;
			}	
		}
		var accounttable2 = AccountTables[1];
		for(var r=0;r<accounttable2.rows.length;r++){
			if(nowtp.Title == accounttable2.rows[r][0]){
				accounttable2.rows[r] =[nowtp.Title, _G(nowtp.Name+"_BuyTimes"), _G(nowtp.Name+"_SellTimes"), (_G(nowtp.Name+"_BuyTimes")+_G(nowtp.Name+"_SellTimes")), parseFloat(_G(nowtp.Name+"_SubProfit")).toFixed(nowtp.Args.PriceDecimalPlace), _G(nowtp.Name+"_Debug"), ['关闭','打开','自动'][_G(nowtp.Name+"_Ssst_CanDo")], _G(nowtp.Name+"_OperateFineness"), _G(nowtp.Name+"_BuyGuidePrice"), _G(nowtp.Name+"_AddTime"), nowtp.LastUpdate];
				break;
			}	
		}		
		var accounttable3 = AccountTables[2];
		for(var r=0;r<accounttable3.rows.length;r++){
			if(nowtp.Title == accounttable3.rows[r][0]){
				if(nowtp.Sssts.length == 3){
					for(var i=0;i<nowtp.Sssts.length;i++){
						var s = nowtp.Sssts[i];
						if(s.Level == accounttable3.rows[r][1]){
							accounttable3.rows[r] = [nowtp.Title, s.Level, ['错误','卖出','买入'][s.Type], s.BuyPrice, s.Type==1 ? s.SellPrice : '-', nowtp.TPInfo.TickerLast, s.Amount, s.OrderID, _D(s.OrderTime)];
							break;
						}
					}
				}else{
					var level = accounttable3.rows[r][1];
					accounttable3.rows[r] = [nowtp.Title, level, '-', '-', '-', '-', '-', '-', '-'];
				}
			}	
		}		
		var accounttable4 = AccountTables[3];
		var newrows = [];
		if(MOOrders && MOOrders.length){
			//先保存非本交易的所有挂单信息
			for(var r=0;r<accounttable4.rows.length;r++){
				if(nowtp.Title != accounttable4.rows[r][0]){
					newrows.push(accounttable4.rows[r]);
				}	
			}
			//然后添加本交易对已经处理好的挂单信息
			for(var r=0;r<TpMOOrders.length;r++){
				newrows.push(TpMOOrders[r].split("|"));
			}
		}
		accounttable4.rows = newrows;
		var accounttable5 = AccountTables[4];
		newrows = [];
		var ConditionCmds = _G("ConditionCmds");
		if(!ConditionCmds) ConditionCmds = []; 
		for(var r=0;r<ConditionCmds.length;r++){
			var cmds = ConditionCmds[r].split("|");
			var cmd = "";
			for(var l=3;l<cmds.length;l++){
				if(l == 3){
					cmd = cmds[l];
				}else{
					cmd += "|"+cmds[l];
				}
			}
			newrows.push([cmds[0],cmds[1],cmds[2],cmd,_D(parseInt(cmds[0]))]);
		}
		accounttable5.rows = newrows;
	}
	LogStatus("`" + JSON.stringify(ArgTables)+"`\n`" + JSON.stringify(AccountTables)+"`\n 策略累计收益："+ _G("TotalProfit")+ "\n 策略启动时间："+ StartTime + " 累计刷新次数："+ TickTimes + " 最后刷新时间："+ _D());	
}

//MO挂单管理
function checkMOOrder(tp){
	if(MOOrders && MOOrders.length){
		//更新交易对的订单
		var newmoorders = [];
		TpMOOrders = [];
		for(var i=0;i<MOOrders.length;i++){
			var moorder = MOOrders[i];
			var keys = moorder.split("|");
			if(tp.Name == keys[0]){
				//更新本交易的挂单列表
				var orderid = keys[1];
				var order = tp.Exchange.GetOrder(orderid);
				if(!order) continue;	//如果订单已经不存在（可以有被APP取消），就跳过
				if(order.Status === ORDER_STATE_PENDING ){
					//对未完成的订单更新订单
					//['交易对','订单编号','交易类型','买入价','卖出价','当前币价','交易量','完成量','挂单时间'];
					var tporder = tp.Title+"|"+orderid;
					if(order.Type == ORDER_TYPE_SELL){
						tporder += "|卖出|"+tp.TPInfo.AvgPrice;
						if(order.Price){
							tporder += "|"+order.Price;
						}else{
							tporder += "|市价"+order.Price;
						}
					}else{
						tporder += "|买入"; 
						if(order.Price){
							tporder += "|"+order.Price+"|-";
						}else{
							tporder += "|市价"+order.Price+"|-";
						}
					}
					tporder += "|"+tp.TPInfo.TickerLast+"|"+order.Amount+"|"+order.DealAmount+"|"+_D(order.Info["created-at"]);
					TpMOOrders.push(tporder);
					newmoorders.push(moorder);
				}else{
					//对已经完成的有成交的订单进行处理，不管是已经完成或是取消状态
					if(order.DealAmount){
						if(order.Type == ORDER_TYPE_SELL){
							//算出扣除平台手续费后实际的数量
							var avgPrice = _G(tp.Name+"_AvgPrice");
							var TotalProfit = _G("TotalProfit");
							var SubProfit = _G(tp.Name+"_SubProfit");
							var profit = parseFloat((order.AvgPrice*order.DealAmount*(1-tp.Args.SellFee) - avgPrice*order.DealAmount).toFixed(tp.Args.PriceDecimalPlace));
							SubProfit += profit;
							TotalProfit += profit;
							tp.Profit = SubProfit;
							_G(tp.Name+"_SubProfit", SubProfit);
							_G("TotalProfit", TotalProfit);
							LogProfit(TotalProfit);
							
							if(order.Status === ORDER_STATE_CLOSED ){
								Log(tp.Title,"交易对MO挂单",orderid,"交易成功!平均卖出价格：",order.AvgPrice,"，平均持仓价格：",avgPrice,"，卖出数量：",order.DealAmount,"，毛收盈：",profit,"，累计毛收盈：",TotalProfit);
							}else{
								Log(tp.Title,"交易对MO挂单",orderid,"部分成交!卖出数量：",order.DealAmount,"，剩余数量：",order.Amount - order.DealAmount,"，平均卖出价格：",order.AvgPrice,"，平均持仓价格：",avgPrice,"，毛收盈：",profit,"，累计毛收盈：",TotalProfit);
							}
							
							//如果当前持仓数量小于最小交量数量或最小持仓量时，指导买入价格重置为成交价和平均价的中间价，方便短线操作
							if(tp.TPInfo.Stocks <= tp.Args.MinCoinLimit+tp.Args.TradeLimits.MPOMinSellAmount*2 ){
								var guideBuyPrice = parseFloat(((order.AvgPrice+avgPrice)/2).toFixed(tp.Args.PriceDecimalPlace));
								Log(tp.Title,"交易对空仓至最小持币量，将指导买入价调整为",guideBuyPrice);
								_G(tp.Name+"_LastBuyPrice",guideBuyPrice);
								_G(tp.Name+"_BuyGuidePrice",guideBuyPrice);
								_G(tp.Name+"_LastSellPrice",0);
								//调整动态点数
								_G(tp.Name+"_BuyDynamicPoint", tp.Args.BuyPoint);
								//重新计算操作粒度
								if(exchanges.length == 1) _G(tp.Name+"_OperateFineness", parseFloat((GetAccount(tp).Balance/guideBuyPrice/Transaction_Depth).toFixed(tp.Args.StockDecimalPlace)));
							}
							
							//列新交易次数
							var tradeTimes = _G(tp.Name+"_SellTimes");
							tradeTimes++;
							_G(tp.Name+"_SellTimes",tradeTimes);
						}else{
							//读取原来的持仓均价和持币总量
							var avgPrice = _G(tp.Name+"_AvgPrice");
							var beforeBuyingStocks = _G(tp.Name+"_BeforeBuyingStocks");
							if(order.Status === ORDER_STATE_CLOSED ){
								Log(tp.Title,"交易对MO买入挂单",orderid,"已经成功!成交均价：",order.AvgPrice,"，挂单买入：",order.Amount,"，买到数量：",order.DealAmount);			
							}else{
								Log(tp.Title,"交易对MO买入挂单",orderid,"已经部分成交!成交均价：",order.AvgPrice,"，挂单买入：",order.Amount,"，买到数量：",order.DealAmount);		
							}
							
							var flag = false;	
							if(beforeBuyingStocks > tp.Args.MinCoinLimit+tp.Args.TradeLimits.MPOMinSellAmount && (tp.Sssts.length && order.AvgPrice < _G(tp.Name+"_LastBuyPrice") || tp.Sssts.length == 0)){
								//检测当前是否存在短线交易
								if(tp.Sssts.length){
									//存在，检测当前交易是否完成,没有完成强制取消挂单
									Log(tp.Title,"交易对先前存在短线交易挂单，现检测当前交易是否完成,没有完成强制取消挂单。");
									var ret = checkSsstSellFinish(tp, true);
									if(!ret){
										//如果挂单还没有取消成功,再次尝试取消挂单
										for(var i=0;i<tp.Sssts.length;i++){
											tp.Exchange.CancelOrder(tp.Sssts[i].OrderID);
										}
									}
								}
								//再次检测是否有未完成的挂单
								if(tp.Sssts.length){
									var Amount = 0;
									var BuyPrice = tp.Sssts[0].BuyPrice;
									for(var i=0;i<tp.Sssts.length;i++){
										Amount += tp.Sssts[i].Amount;
									}
									Log(tp.Title,"交易对先前的短线交易挂单未完成，现将其未完成的量",Amount,"按",BuyPrice,"买入计入长线核算。");
									//有挂单没有完成，将挂单数量和金额计入持仓均价
									var coinAmount = beforeBuyingStocks + Amount;
									//计算持仓总价
									var Total = parseFloat((avgPrice*beforeBuyingStocks + BuyPrice * Amount*(1+tp.Args.BuyFee)).toFixed(tp.Args.PriceDecimalPlace));
									
									//计算并调整平均价格
									avgPrice = parseFloat((Total / coinAmount).toFixed(tp.Args.PriceDecimalPlace));
									_G(tp.Name+"_AvgPrice",avgPrice);
									
									Log(tp.Title,"交易对先前的短线交易挂单买入价：",BuyPrice,"，未卖出数量：",Amount,"，长线持仓价格调整到：",avgPrice,"，总持仓数量：",coinAmount,"，总持币成本：",Total);			
									
									//保存每次买入之后币的数量
									_G(tp.Name+"_lastBuycoinAmount", coinAmount);
									
									//调整新的beforeBuyingStocks变量，以方便下面的计算
									beforeBuyingStocks = coinAmount;
								}
								
								//清空原来的挂单数组内容
								tp.Sssts = [];
								
								if(checkCanDoSsst(tp, GetAccount(tp))){
									//将当前买入作为短线卖单挂出
									Log(tp.Title,"交易对计划对当前成功的买入量做短线卖出挂单。");
									var finish = false;
									for(var i=0;i<3;i++){
										var newSsst = new SsstData();
										newSsst.Type = 1;
										newSsst.BuyPrice = order.AvgPrice;
										newSsst.Amount = order.DealAmount/3;
										var profit = THRID_ORDERY_LEVELS[i];
										newSsst.Level = profit;
										newSsst.SellPrice = parseFloat((order.AvgPrice*(1+profit+tp.Args.BuyFee+tp.Args.SellFee)).toFixed(tp.Args.PriceDecimalPlace));
										tp.Exchange.SetPrecision(tp.Args.PriceDecimalPlace, tp.Args.StockDecimalPlace);
										var orderid = tp.Exchange.Sell(newSsst.SellPrice, newSsst.Amount);
										if(orderid){
											//挂单成功
											Log(tp.Title,"交易对将当前成功的买入量的1/3做",profit*100,"%卖出挂单成功，订单编号",orderid);
											newSsst.OrderID = orderid;
											newSsst.OrderTime = new Date().getTime();
											newSsst.LastBuyPrice = _G(tp.Name+"_LastBuyPrice");
											tp.Sssts.push(newSsst);
											//保存挂单信息
											_G(tp.Name+"_Ssst_Type"+i, newSsst.Type);
											_G(tp.Name+"_Ssst_Level"+i, newSsst.Level);
											_G(tp.Name+"_Ssst_BuyPrice"+i, newSsst.BuyPrice);
											_G(tp.Name+"_Ssst_Amount"+i, newSsst.Amount);
											_G(tp.Name+"_Ssst_SellPrice"+i, newSsst.SellPrice);
											_G(tp.Name+"_Ssst_OrderID"+i, newSsst.OrderID);
											_G(tp.Name+"_Ssst_OrderTime"+i, newSsst.OrderTime);	
											//设置标签
											finish = true;
										}
									}
									//挂单完成
									if(finish){
										//做个延时处理
										Sleep(1000);
									}else{
										Log(tp.Title,"交易对计划对当前买入做挂单，但挂单不成功，现将其按长线买入计入长线核算。");
										//有挂单不成功，将数量和金额计入长线核算
										flag = true;
									}
								}else{
									Log(tp.Title,"交易对现在不允许做短线交易操作，现将直接按长线买入计入长线核算。");
									flag = true;
								}
							}else{
								//当前持仓量小于最小持仓量和最小交易量的总和，不作短线卖出挂单，直接计入长线核算
								flag = true;
							}
							
							//核算总持币量
							var coinAmount = beforeBuyingStocks + order.DealAmount;
							//是否对当前买入量计入长线核算
							if(flag){
								//计算持仓总价
								var Total = parseFloat((avgPrice*beforeBuyingStocks+order.AvgPrice * order.DealAmount*(1+tp.Args.BuyFee)).toFixed(tp.Args.PriceDecimalPlace));
								
								//计算并调整平均价格
								avgPrice = parseFloat((Total / coinAmount).toFixed(tp.Args.PriceDecimalPlace));
								_G(tp.Name+"_AvgPrice",avgPrice);
								
								Log(tp.Title,"交易对当前买入计入核算，长线持仓价格调整到：",avgPrice,"，总持仓数量：",coinAmount,"，总持币成本：",Total);			
							}
							
							//列新交易次数
							var tradeTimes = _G(tp.Name+"_BuyTimes");
							tradeTimes++;
							_G(tp.Name+"_BuyTimes",tradeTimes);
							
							//保存每次买入之后币的数量
							_G(tp.Name+"_lastBuycoinAmount", coinAmount);
						}
					}
				}			
			}else{
				//恢复非本交易对的所有挂单信息
				newmoorders.push(moorder);
			}
		}
		//更新全局变量当中的列表
		MOOrders = newmoorders;
		//存储到本地存储
		_G("MOOrders", MOOrders);
	}
}

function main() {
	Log("开始执行主事务程序...");  
	//执行循环事务
	while (true) {
		if(TradePairs.length){
			LastRecords = {"DayRecords":null,"HourRecords":null};
			//策略交互处理函数
			commandProc(GetCommand());
			//获取当前交易对
			var tp = TradePairs[NowTradePairIndex];
			if(_G(tp.Name+"_Debug") == "1") Log("开始操作",tp.Title,"交易对...");
			//处理条件交互操作
			procConditionCmd(tp);
			//检测短线交易成功
			ssstHandle(tp);
			//操作长线交易
			if(!onTick(tp)) break;
			//MO交易挂单的管理
			checkMOOrder(tp);
			//操作状态显示
			tp.LastUpdate = _D();
			showStatus(tp);
			//控制轮询
			if(NowTradePairIndex === TradePairs.length-1){
				NowTradePairIndex = 0;
				//同时清除日志保留最后5000条，以缩减托管者上SqlLit3文件的大小
				LogReset(5000);
			}else{
				NowTradePairIndex++;
			}
            var interval = 60/TradePairs.length;
			if(interval < 5) interval = 5;
			if(interval > 20) interval = 20;
            Sleep(interval * 1000);
		}else{
			Log("匹配的交易对为空，请提供正常的交易对参数JSON内容。");
			break;
		}
	}
}