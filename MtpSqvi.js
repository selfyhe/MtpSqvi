/**************************************
多交易对现货长线量化价值投资策略V2.3
说明：
1.本策略使用与行情无关，只与价格相关的设计思想，脱离技术指标不作任何预测，实现长线价值投资。
2.本策略重在稳定长期盈利，保持胜率100%是原则，为投资带来稳定的较高的回报。
3.在保持长线策略的同时增加了短线交易操作、日线金叉保仓操作、超跌超底操作，使得收盈能力大大提升。

支持多个交易对，参数通过JSON传递过来
Json	策略参数JSON内容	JSON内容为以下多个交易对的数组JSON	字符串型(string)

单个交易对的策略参数如下
参数	描述	类型	默认值
TradePairName	交易对名称	字符串型(string)	
MaxCoinLimit	最大持仓量	数字型(number)	1200
MinCoinLimit	最小持仓量	数字型(number)	600
OperateFineness	买卖操作的粒度	数字型(number)	100
NowCoinPrice	当前持仓平均价格/指导买入价格	数字型(number)	0
BuyFee	平台买入手续费		数字型(number)	0.002
SellFee	平台卖出手续费		数字型(number)	0.002
PriceDecimalPlace	交易对价格小数位		数字型(number)	2 
StockDecimalPlace	交易对数量小数位		数字型(number)	4 
MinStockAmount	限价单最小交易数量		数字型(number)	1
BuyPoint 指导买入点	是数值不是百分比	数字型(number)	0.05
SellPoint 指导卖出点	是数值不是百分比	数字型(number)	0.05

策略交互如下
NewAvgPrice	更新持仓平均价格	只更新均价不更新上一次买入卖出价，用于手动操作买入之后的均价调整，填写格式：TradePairName|Price    字符串型(string) _|_
GuideBuyPrice	更新指导买入价格    只更新上一个买入价，不更新持仓均价，用于想调节买入点，填写格式：TradePairName|Price	字符串型(string) _|_
NewBuyPoint	更新买入点数	根据行情的变化，调整买入的点数，是数值不是百分比，填写格式：TradePairName(更新全部交易对用ALL)|小于0.5大于BuyFee数值	字符串型(string) _|_
NewSellPoint	更新卖出点数	根据行情的变化，调整卖出的点数，是数值不是百分比，填写格式：TradePairName(更新全部交易对用ALL)|大于SellFee数值	字符串型(string) _|_
Debug	更新调试状态	值的填写格式如下:TradePairName(更新全部交易对用ALL)|0/1 字符串型(string) ALL|0
************************************************/

//全局常数定义
//操作类型常量
var OPERATE_STATUS_NONE = -1;
var OPERATE_STATUS_BUY = 0; 
var OPERATE_STATUS_SELL = 1;

//全局变量定义
function TradePair(){
	this.Name = "";	//交易对名称,用于定量加前缀，格式如Huobi_LTC_BTC
	this.Title = "";	//交易对标题，用于表格显示，格式如Huobi/LTC_BTC
	this.Exchange = {};	//交易所对像exchange
	this.TPInfo = {};	//交易对当前信息
	this.Args = {};	//本交易对参数
	this.LastUpdate = {};	//最后更新时间
	this.Ssst = {};		//短线交易操作对像
}
function SsstData(){
	this.Exists = 0;	//是否存在短线交易
	this.BuyPrice = 0;	//买入价
	this.Amount = 0;	//交易量
	this.SellPrice = 0;	//卖出价
	this.OrderID = 0;	//订单编号
	this.OrderTime = 0;	//持单时间戳
	this.LastBuyPrice = 0;	//上次买入的价格
}
var TradePairs = [];	//所有交易对数组
var NowTradePairIndex = 0;		//当前的交易所对索引
var TotalProfit = 0;	//策略累计收益
var StartTime = _D();	//策略启动时间
var TickTimes = 0;		//刷新次数
var ArgTables;		//已经处理好的用于显示的参数表，当参数更新时置空重新生成，以加快刷新速度
var AccountTables;	//当前的账户信息表，如果当前已经有表，只要更新当前交易对，这样可以加快刷新速度，减少内存使用
var AddPointInBuy = 0.008;	//买入价格动态点增加数
var AddPointInSell = -0.005;	//卖出价格动态点增加数
var LastRecords = {"DayRecords":null,"HourRecords":null};

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

//验证JSON内容格式
function isJSON(str) {
    if (typeof str == 'string') {
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
		Log(tp.Name,"交易对参数：最大持仓量为0，必须填写此字段。 #FF0000");
		ret = false;
	}
	if(a.OperateFineness === 0){
		Log(tp.Name,"交易对参数：买卖操作的粒度为0，必须填写此字段。 #FF0000");
		ret = false;
	}
	if(a.BuyFee === 0 || a.SellFee === 0){
		Log(tp.Name,"交易对参数：平台买卖手续费为0，必须填写此字段。 #FF0000");
		ret = false;
	}
	if(a.PriceDecimalPlace === 0 || a.StockDecimalPlace === 0){
		Log(tp.Name,"交易对参数：交易对价格/数量小数位为0，必须填写此字段。 #FF0000");
		ret = false;
	}
	if(a.MinStockAmount === 0){
		Log(tp.Name,"交易对参数：限价单最小交易数量为0，必须填写此字段。 #FF0000");
		ret = false;
	}
	if(a.BuyPoint === 0){
		Log(tp.Name,"交易对参数：指导买入点为0，必须填写此字段。 #FF0000");
		ret = false;
	}
	if(a.SellPoint === 0){
		Log(tp.Name,"交易对参数：指导卖出点为0，必须填写此字段。 #FF0000");
		ret = false;
	}
	Log(tp.Title,"交易对接收参数如下：最大持仓量", a.MaxCoinLimit, "，买卖操作的粒度", a.OperateFineness, "，当前持仓平均价格/指导买入价格", a.NowCoinPrice, "，平台买卖手续费（", a.BuyFee, a.SellFee,"），交易对价格/数量小数位（", a.PriceDecimalPlace, a.StockDecimalPlace,"），限价单最小交易数量", a.MinStockAmount,"，指导买入点", a.BuyPoint,"，指导卖出点", a.SellPoint);
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
					MinStockAmount:args[i].MinStockAmount,
					BuyPoint:args[i].BuyPoint,
					SellPoint:args[i].SellPoint
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
					_G(tp.Name+"_Debug",args[i].Debug);
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
	//重置日志
    LogReset();
	SetErrorFilter("403:|502:|503:|Forbidden|tcp|character|unexpected|network|timeout|WSARecv|Connect|GetAddr|no such|reset|http|received|EOF|reused");

	Log("启动多交易对现货长线量化价值投资策略程序...");  

	//初始化存储变量
	if(!_G("TotalProfit")) _G("TotalProfit",0);

	//解析JSON参数
	parseArgsJson(Json);
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
    if (arr1.length !== arr2.length) {
        throw "array length not equal";
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
	
	//设置最后一次卖出价格
	if(order.DealAmount>(order.Amount/2)){
		_G(tp.Name+"_LastSellPrice",parseFloat(order.AvgPrice));
	}
	
	//如果当前持仓数量小于最小交量数量或最小持仓量时，指导买入价格重置为成交价和平均价的中间价，方便短线操作
	var coinAmount = getAccountStocks(account); //从帐户中获取当前持仓信息
	if(coinAmount <= tp.Args.MinCoinLimit+tp.Args.MinStockAmount*2 ){
		var guideBuyPrice = parseFloat(((order.AvgPrice+avgPrice)/2).toFixed(tp.Args.PriceDecimalPlace));
		Log(tp.Title,"交易对空仓至最小持币量，将指导买入价调整为",guideBuyPrice);
		_G(tp.Name+"_LastBuyPrice",guideBuyPrice);
		_G(tp.Name+"_LastSellPrice",0);
	}else{
		//卖出成功，重置上一次买入价格，以方便下跌补仓
		_G(tp.Name+"_LastBuyPrice",0);
	}
	
	//列新交易次数
	var tradeTimes = _G(tp.Name+"_SellTimes");
	tradeTimes++;
	_G(tp.Name+"_SellTimes",tradeTimes);
	
	//调整动态点数
	var sellDynamicPoint = _G(tp.Name+"_SellDynamicPoint") ? _G(tp.Name+"_SellDynamicPoint") : tp.Args.SellPoint;
	var newsdp = sellDynamicPoint+AddPointInSell;
	sellDynamicPoint = newsdp < tp.Args.SellPoint/2 ? tp.Args.SellPoint/2 : newsdp;
	_G(tp.Name+"_SellDynamicPoint", sellDynamicPoint);
	var buyDynamicPoint = _G(tp.Name+"_BuyDynamicPoint") ? _G(tp.Name+"_BuyDynamicPoint") : tp.Args.BuyPoint;
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
			Log(tp.Title,"交易对订单",lastOrderId,"未有成交!卖出价格：",order.Price,"，当前价：",GetTicker(tp).Last,"，价格差：",_N(order.Price - GetTicker(tp).Last, tp.Args.PriceDecimalPlace));
		}
		//撤消没有完成的订单，如果交叉周期在5以内不急着取消挂单        
		tp.Exchange.CancelOrder(lastOrderId);
		Log(tp.Title,"交易对取消卖出订单：",lastOrderId);
		Sleep(1300);
	}
    return ret;
}

//处理买入成功之后数据的调整
function changeDataForBuy(tp,account,order){
	//读取原来的持仓均价和持币总量
	var avgPrice = _G(tp.Name+"_AvgPrice");
	var beforeBuyingStocks = _G(tp.Name+"_BeforeBuyingStocks");
	if(order.Status === ORDER_STATE_CLOSED ){
		Log(tp.Title,"交易对买入订单",_G(tp.Name+"_LastOrderId"),"交易成功!成交均价：",order.AvgPrice,"，挂单买入：",order.Amount,"，买到数量：",order.DealAmount);			
	}else{
		Log(tp.Title,"交易对买入订单",_G(tp.Name+"_LastOrderId"),"部分成交!成交均价：",order.AvgPrice,"，挂单买入：",order.Amount,"，买到数量：",order.DealAmount);		
	}
	
	var flag = false;	
	if(beforeBuyingStocks > tp.Args.MinCoinLimit+tp.Args.MinStockAmount){
		//检测当前是否存在短线交易
		if(tp.Ssst.Exists ){
			//存在，检测当前交易是否完成,没有完成强制取消挂单
			Log(tp.Title,"交易对先前存在短线交易挂单，现检测当前交易是否完成,没有完成强制取消挂单。");
			var ret = checkSsstSellFinish(tp, true);
			if(!ret){
				//如果挂单还没有取消成功,再次尝试取消挂单
				tp.Exchange.CancelOrder(tp.Ssst.OrderID);
			}
		}
		//再次检测是否有未完成的挂单
		if(tp.Ssst.Exists){
			Log(tp.Title,"交易对先前的短线交易挂单未完成，现将其未完成的量",tp.Ssst.Amount,"按",tp.Ssst.BuyPrice,"买入计入长线核算。");
			//有挂单没有完成，将挂单数量和金额计入持仓均价
			var coinAmount = beforeBuyingStocks + tp.Ssst.Amount;
			//计算持仓总价
			var Total = parseFloat((avgPrice*beforeBuyingStocks + tp.Ssst.BuyPrice * tp.Ssst.Amount*(1+tp.Args.BuyFee)).toFixed(tp.Args.PriceDecimalPlace));
			
			//计算并调整平均价格
			avgPrice = parseFloat((Total / coinAmount).toFixed(tp.Args.PriceDecimalPlace));
			_G(tp.Name+"_AvgPrice",avgPrice);
			
			Log(tp.Title,"交易对先前的短线交易挂单买入价：",tp.Ssst.BuyPrice,"，未卖出数量：",tp.Ssst.Amount,"，长线持仓价格调整到：",avgPrice,"，总持仓数量：",coinAmount,"，总持币成本：",Total);			
			
			//设置最后一次买入价格
			_G(tp.Name+"_LastBuyPrice",parseFloat(tp.Ssst.BuyPrice));
							
			//每次买入一次重置上一次卖出价格，方便以新的成本价计算下次卖出价
			_G(tp.Name+"_LastSellPrice",0);
			
			//保存每次买入之后币的数量
			_G(tp.Name+"_lastBuycoinAmount", coinAmount);
			
			//调整新的beforeBuyingStocks变量，以方便下面的计算
			beforeBuyingStocks = coinAmount;
		}
		
		if(checkCanDoSsst(tp, account)){
			//将当前买入作为短线卖单挂出
			var newSsst = new SsstData();
			newSsst.Exists = 1;
			newSsst.BuyPrice = order.AvgPrice;
			newSsst.Amount = order.DealAmount;
			newSsst.SellPrice = parseFloat((order.AvgPrice*(1+0.01+tp.Args.BuyFee+tp.Args.SellFee)).toFixed(tp.Args.PriceDecimalPlace));
			Log(tp.Title,"交易对计划对当前成功的买入量做短线卖出挂单。");
			var orderid = tp.Exchange.Sell(newSsst.SellPrice, newSsst.Amount);
			if(orderid){
				//挂单成功
				Log(tp.Title,"交易对将当前成功的买入量做卖出挂单成功，订单编号",orderid);
				newSsst.OrderID = orderid;
				newSsst.OrderTime = new Date().getTime();
				newSsst.LastBuyPrice = _G(tp.Name+"_LastBuyPrice");
				tp.Ssst = newSsst;
				//保存挂单信息
				_G(tp.Name+"_Ssst_Exists", 1);
				_G(tp.Name+"_Ssst_BuyPrice", newSsst.BuyPrice);
				_G(tp.Name+"_Ssst_Amount", newSsst.Amount);
				_G(tp.Name+"_Ssst_SellPrice", newSsst.SellPrice);
				_G(tp.Name+"_Ssst_OrderID", newSsst.OrderID);
				_G(tp.Name+"_Ssst_OrderTime", newSsst.OrderTime);	
				_G(tp.Name+"_Ssst_LastBuyPrice", newSsst.LastBuyPrice);	
				
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
			if(tp.Ssst.Exists){
				//清除旧的挂单信息
				_G(tp.Name+"_Ssst_Exists", 0);
				_G(tp.Name+"_Ssst_BuyPrice", 0);
				_G(tp.Name+"_Ssst_Amount", 0);
				_G(tp.Name+"_Ssst_SellPrice", 0);
				_G(tp.Name+"_Ssst_OrderID", 0);
				_G(tp.Name+"_Ssst_OrderTime", 0);	
				_G(tp.Name+"_Ssst_LastBuyPrice", 0);					
			}
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
	
	//设置最后一次买入价格,仅在买入量超过一半的情况下调整最后买入价格，没到一半继续买入
	Log("changeDataForBuy order.Price", order.Price);
	if(order.Price != 0 && order.DealAmount>(order.Amount/2) || order.Price == 0 && order.DealAmount>(order.Amount/order.AvgPrice/2)){
		_G(tp.Name+"_LastBuyPrice",parseFloat(order.AvgPrice));
	}

	//列新交易次数
	var tradeTimes = _G(tp.Name+"_BuyTimes");
	tradeTimes++;
	_G(tp.Name+"_BuyTimes",tradeTimes);
	
	//每次买入一次重置上一次卖出价格，方便以新的成本价计算下次卖出价
	_G(tp.Name+"_LastSellPrice",0);
	_G(tp.Name+"_HistoryHighPoint", 0);
	
	//保存每次买入之后币的数量
	_G(tp.Name+"_lastBuycoinAmount", coinAmount);
	
	//调整动态点数
	var buyDynamicPoint = _G(tp.Name+"_BuyDynamicPoint") ? _G(tp.Name+"_BuyDynamicPoint") : tp.Args.BuyPoint;
	var loc = getInDayLineLocation(tp);
	if((loc.Now-loc.Low)/(loc.High-loc.Low) < 0.1){
		var newbdp = buyDynamicPoint-AddPointInBuy;
		buyDynamicPoint = newbdp < tp.Args.BuyPoint ? tp.Args.BuyPoint : newbdp;
		_G(tp.Name+"_BuyDynamicPoint", buyDynamicPoint-AddPointInBuy);
	}else{
		_G(tp.Name+"_BuyDynamicPoint", buyDynamicPoint+AddPointInBuy);
	}
	var sellDynamicPoint = _G(tp.Name+"_SellDynamicPoint") ? _G(tp.Name+"_SellDynamicPoint") : tp.Args.SellPoint;
	if(sellDynamicPoint != tp.Args.SellPoint) _G(tp.Name+"_SellDynamicPoint", tp.Args.SellPoint);	
}

//检测买入订单是否成功
function checkBuyFinish(tp,account){
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
			Log(tp.Title,"交易对买入订单",lastOrderId,"未有成交!订单买入价格：",order.Price,"，当前卖一价：",GetTicker(tp).Sell,"，价格差：",_N(order.Price - GetTicker(tp).Sell, tp.Args.PriceDecimalPlace));
		}
		//撤消没有完成的订单
		tp.Exchange.CancelOrder(lastOrderId);
		Log(tp.Title,"交易对取消未完成的买入订单：",lastOrderId);
		Sleep(1300);
	}
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
function commandProc(){
    var cmd=GetCommand();
	if(cmd){
		var cmds=cmd.split(":");
		var values;
		var tp;
		if(cmds.length === 2){
			values = cmds[1].split("|");
			if(values.length === 2){
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
			if(cmds[0] == "NewAvgPrice"){
				if(values[1] == 0){
					Log(tp.Name,"尝试更新持仓价格为0，拒绝操作！！！");
				}else{
					Log(tp.Name,"更新持仓价格为",values[1]);
					tp.Args.NowCoinPrice = parseFloat(values[1]);
					_G(tp.Name+"_AvgPrice",parseFloat(values[1]));
					ArgTables = null;
					AccountTables = null;
				}
			}else if(cmds[0] == "GuideBuyPrice"){
				if(values[1] == 0){
					Log(tp.Name,"不能设置价格为0的指导买入价格！！！");
				}else{
					Log(tp.Name,"更新指导买入价格为",values[1]);
					_G(tp.Name+"_LastBuyPrice",parseFloat(values[1]));
					AccountTables = null;
				}
			}else if(cmds[0] == "NewBuyPoint"){
				if(values[0].toUpperCase() == "ALL"){
					for(var i=0;i<TradePairs.length;i++){
						TradePairs[i].Args.BuyPoint = parseFloat(values[1]);
					}
					Log("更新所有交易对买入点数为",values[1]," #FF0000");
				}else{
					if(cmds[1] <= tp.Args.BuyFee){
						Log(tp.Name,"输入的买入点数小于平台交易费，请确认参数是否正确！！！");
					}else if(cmds[1] > 0.5){
						Log(tp.Name,"输入的买入点数过大可能无法成交，请确认参数是否正确！！！");
					}else{
						Log(tp.Name,"更新买入点数为",values[1]);
						tp.Args.BuyPoint = parseFloat(values[1]);
					}
				}
				Log("对买入点的基数的修改只是本次运行有效，要下次运行有效请修改参数JSON",values[1]," #FF0000");
				ArgTables = null;
			}else if(cmds[0] == "NewSellPoint"){
				if(values[0].toUpperCase() == "ALL"){
					for(var i=0;i<TradePairs.length;i++){
						TradePairs[i].Args.SellPoint = parseFloat(values[1]);
					}
					Log("更新所有交易对卖出点数为",values[1]," #FF0000");
				}else{
					if(cmds[1] <= tp.Args.SellFee){
						Log(tp.Name,"输入的卖出点数小于平台交易费，请确认参数是否正确！！！");
					}else{
						Log(tp.Name,"更新卖出点数为",values[1]);
						tp.Args.SellPoint = parseFloat(values[1]);
					}
				}
				Log("对卖出点的基数的修改只是本次运行有效，要下次运行有效请修改参数JSON",values[1]," #FF0000");
				ArgTables = null;
			}else if(cmds[0] == "Debug"){
				if(values[0].toUpperCase() == "ALL"){
					for(var i=0;i<TradePairs.length;i++){
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

//检测短线卖出订单是否成功
function checkSsstSellFinish(tp, cancelorder){
	var ret = false;
	var order = tp.Exchange.GetOrder(tp.Ssst.OrderID);
	if(!order) return ret;
	if(order.Status === ORDER_STATE_CLOSED || order.Status === ORDER_STATE_PENDING && cancelorder && order.DealAmount){
		//累计盈利
		var TotalProfit = _G("TotalProfit");
		var SubProfit = _G(tp.Name+"_SubProfit");
		var profit = parseFloat((order.AvgPrice*order.DealAmount*(1-tp.Args.SellFee) - tp.Ssst.BuyPrice*order.DealAmount*(1+tp.Args.BuyFee)).toFixed(tp.Args.PriceDecimalPlace));
		SubProfit += profit;
		TotalProfit += profit;
		tp.Profit = SubProfit;
		_G(tp.Name+"_SubProfit", SubProfit);
		_G("TotalProfit", TotalProfit);
		LogProfit(TotalProfit);

		if(order.Status === ORDER_STATE_CLOSED){
			Log(tp.Title,"交易对短线挂单",tp.Ssst.OrderID,"交易成功!卖出价格：",order.AvgPrice,"，买入价格：",tp.Ssst.BuyPrice,"，卖出数量：",order.DealAmount,"，毛收盈：",profit,"，累计毛收盈：",TotalProfit);
		}else{
			Log(tp.Title,"交易对短线挂单",tp.Ssst.OrderID,"部分成交!卖出数量：",order.DealAmount,"，剩余数量：",order.Amount - order.DealAmount,"，卖出价格：",order.AvgPrice,"，买入价格：",avgPrice,"，毛收盈：",profit,"，累计毛收盈：",TotalProfit);
		}
		
		//列新交易次数
		var tradeTimes = _G(tp.Name+"_SellTimes");
		tradeTimes++;
		_G(tp.Name+"_SellTimes",tradeTimes);
		
		//更新剩余数量到Ssst对像
		if(order.Status === ORDER_STATE_PENDING && order.DealAmount){
			tp.Ssst.Amount = order.Amount - order.DealAmount;
			_G(tp.Name+"_Ssst_Amount", tp.Ssst.Amount);
		}
	}

	if(order.Status === ORDER_STATE_CLOSED){
		//挂单顺利卖出，恢复上次买入价格和动态买入点。
		_G(tp.Name+"_LastBuyPrice", tp.Ssst.LastBuyPrice);
		var buyDynamicPoint = _G(tp.Name+"_BuyDynamicPoint");
		if(!cancelorder){	//只要不是在买入成功检测之前挂单的情况下可以把买入点调回上一次买入点
			_G(tp.Name+"_BuyDynamicPoint", buyDynamicPoint-AddPointInBuy);
		}
		//挂单已经完成，重置Ssst对像
		tp.Ssst = new SsstData();
		_G(tp.Name+"_Ssst_Exists", 0);
		_G(tp.Name+"_Ssst_BuyPrice", 0);
		_G(tp.Name+"_Ssst_Amount", 0);
		_G(tp.Name+"_Ssst_SellPrice", 0);
		_G(tp.Name+"_Ssst_OrderID", 0);
		_G(tp.Name+"_Ssst_OrderTime", 0);
		_G(tp.Name+"_Ssst_LastBuyPrice", 0);
		ret = true;
	}else{
		//撤消没有完成的订单
		if(cancelorder){
			Log(tp.Title,"交易对取消未完成的短线交易挂单：",tp.Ssst.OrderID);			
			var retc = tp.Exchange.CancelOrder(tp.Ssst.OrderID);
			if(retc){
				tp.Ssst.OrderID = 0;
				tp.Ssst.OrderTime = 0;
				_G(tp.Name+"_Ssst_OrderID", 0);
				_G(tp.Name+"_Ssst_OrderTime", 0);
				ret = true;
			}
		}
	}
	return ret;
}

//初始化Ssst对像
function ssstHandle(tp){
	//读取短线交易相关数据，并判断交易状态
	var ssst = new SsstData();
	if(_G(tp.Name+"_Ssst_Exists")){
		ssst.Exists = 1;
		ssst.BuyPrice = _G(tp.Name+"_Ssst_BuyPrice");
		ssst.Amount = _G(tp.Name+"_Ssst_Amount");
		ssst.SellPrice = _G(tp.Name+"_Ssst_SellPrice");
		ssst.OrderID = _G(tp.Name+"_Ssst_OrderID");
		ssst.OrderTime = _G(tp.Name+"_Ssst_OrderTime");
		ssst.LastBuyPrice = _G(tp.Name+"_Ssst_LastBuyPrice");
	}
	tp.Ssst = ssst;

	//检测卖出挂单是否成功
    if(ssst.OrderID){
    	checkSsstSellFinish(tp, false);
    }
}

/**
 * 取得当前在半年范围内的日线的振幅的位置。
 * @param {} tp
 * @return {}
 */
function getInDayLineLocation(tp){
	var loc = {
		"High":0,
		"Low":0,
		"Now":0,
		"LastRecord":{},
		"SecondRecord":{},
		"ThirdRecord":{}
	}
	var records = GetRecords(tp, PERIOD_D1);
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
	return loc;
}

/**
 * 检测当前是否可以做短线交易
 * 1.如果当前价处于半年内日线振幅的低位的10%之内，不做
 * 2.如果当前账户余额在账户总价值的10%以内，不做
 * @param {} tp
 */
function checkCanDoSsst(tp, account){
	var ret = true;
	var loc = getInDayLineLocation(tp);
	if((loc.Now-loc.Low)/(loc.High-loc.Low) < 0.1){
		Log("当前价处于半年内日线振幅的低位的10%之内，不做短线交易");
		ret = false;
	}else if(account.Balance/(account.Balance + _G(tp.Name+"_AvgPrice")*(account.Stocks+account.FrozenStocks)) < 0.1){
		Log("当前账户余额在账户总价值的10%以内，不做短线交易");
		ret = false;
	}else if(loc.SecondRecord.Open/loc.LastRecord.Close >= 1.3 && tp.TPInfo.Stocks < tp.Args.MaxCoinLimit){
		Log("当前日内超跌30%，是吸货的时候，不做短线交易");
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
	var ret = 0;
	var crossnum = Cross(tp, PERIOD_D1, 7, 21);
	var loc = getInDayLineLocation(tp);
	if(crossnum == 1 || crossnum == 2){
		if(loc.LastRecord.Close > loc.LastRecord.Open && loc.SecondRecord.Close > loc.SecondRecord.Open && loc.ThirdRecord.Close > loc.ThirdRecord.Open && tp.TPInfo.Stocks < tp.Args.MaxCoinLimit){
			var nowloc = (loc.Now-loc.Low)/(loc.High-loc.Low);
			var position = tp.TPInfo.CostTotal/(tp.TPInfo.Balance+tp.TPInfo.CostTotal-tp.TPInfo.TickerLast*tp.Args.MinCoinLimit);
			if(nowloc <= 0.05 && position < 0.9){
				Log("满足日K线金叉之后加仓到90%的条件，可以操作买入");
				ret = 0.9;
			}else if(nowloc > 0.05 && nowloc <= 0.20 && position < 0.7){
				Log("满足日K线金叉之后加仓到70%的条件，可以操作买入");
				ret = 0.7;
			}else if(nowloc > 0.20 && nowloc <= 0.30 && position < 0.5){
				Log("满足日K线金叉之后加仓到50%的条件，可以操作买入");
				ret = 0.5;
			}else if(nowloc > 0.30 && nowloc <= 0.40 && position < 0.3){
				Log("满足日K线金叉之后加仓到30%的条件，可以操作买入");
				ret = 0.3;
			}else if(nowloc > 0.40 && nowloc <= 0.50 && position < 0.2){
				Log("满足日K线金叉之后加仓到20%的条件，可以操作买入");
				ret = 0.2;
			}
		}
	}
	if(loc.SecondRecord.High/loc.LastRecord.Close >= 1.3 && tp.TPInfo.Stocks < tp.Args.MaxCoinLimit){
		//日线超跌30%，如果发生短时内，可以买入到6成
		var records = GetRecords(tp,PERIOD_H1);
		var lastrecord = records[records.length - 1];
		var secondrecord = records[records.length - 2];
		if(!secondrecord) secondrecord = lastrecord;
		var downpc = secondrecord.High/lastrecord.Close;
		var position = tp.TPInfo.CostTotal/(tp.TPInfo.Balance+tp.TPInfo.CostTotal);
		if(downpc >= 1.7 && position < 0.9){
			Log("满足时K线跌超50%加仓到90%的条件，可以操作买入");
			ret = 0.9;
		}else if(downpc >= 1.6 && position < 0.8){
			Log("满足时K线跌超50%加仓到80%的条件，可以操作买入");
			ret = 0.8;
		}else if(downpc >= 1.5 && position < 0.7){
			Log("满足时K线跌超40%加仓到70%的条件，可以操作买入");
			ret = 0.7;
		}else if(downpc >= 1.4 && position < 0.6){
			Log("满足时K线跌超40%加仓到60%的条件，可以操作买入");
			ret = 0.6;
		}else if(downpc >= 1.3 && position < 0.5){
			Log("满足时K线跌超30%加仓到50%的条件，可以操作买入");
			ret = 0.5;
		}
	}
	return ret;
}

//定时任务，主业务流程 
function onTick(tp) {
	var debug = _G(tp.Name+"_Debug") == "1" ? true : false;
	//获取实时信息
	var Account = GetAccount(tp);
    var Ticker = GetTicker(tp);
	
	//检测上一个订单，成功就改状态，不成功就取消重新发
	if(_G(tp.Name+"_LastOrderId") && _G(tp.Name+"_OperatingStatus") != OPERATE_STATUS_NONE){
		if(_G(tp.Name+"_OperatingStatus") > OPERATE_STATUS_BUY){
			checkSellFinish(tp,Account);
		}else{
			checkBuyFinish(tp,Account);
		}
		//刚才上一次订单ID清空，不再重复判断
		_G(tp.Name+"_LastOrderId",0);
		//重置操作状态
		_G(tp.Name+"_OperatingStatus", OPERATE_STATUS_NONE);
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
	if(coinAmount > tp.Args.MinStockAmount && avgPrice === 0){
		Log(tp.Name+"交易对账户有持币，但是输入的均价为0，请确认参数！！ #FF0000");
		return false;
	}
	var buyDynamicPoint = _G(tp.Name+"_BuyDynamicPoint") ? _G(tp.Name+"_BuyDynamicPoint") : tp.Args.BuyPoint;	
	var sellDynamicPoint = _G(tp.Name+"_SellDynamicPoint") ? _G(tp.Name+"_SellDynamicPoint") : tp.Args.SellPoint;
    var lastBuyPrice = _G(tp.Name+"_LastBuyPrice") ? _G(tp.Name+"_LastBuyPrice") : 0;
    var lastSellPrice = _G(tp.Name+"_LastSellPrice") ? _G(tp.Name+"_LastSellPrice") : 0;
	var historyHighPoint = _G(tp.Name+"_HistoryHighPoint") ? _G(tp.Name+"_HistoryHighPoint") : 0;
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
    var crossNum = Cross(tp, PERIOD_D1, 7, 21);
    if (crossNum > 0) {
        if(debug) Log("当前交叉数为", crossNum, ",处于上升通道");
    } else {
        if(debug) Log("当前交叉数为", crossNum, ",处于下降通道");
    }
    var baseBuyPrice = lastBuyPrice ? lastBuyPrice : avgPrice;
    var baseSellPrice = lastSellPrice ? lastSellPrice : avgPrice;
    if(debug) Log("当前基准买入价格=", baseBuyPrice, "，当前基准卖出价格=", baseSellPrice, "，动态买入点", buyDynamicPoint, "，动态买出点", sellDynamicPoint, "，当前币价", Ticker.Sell);
    if (crossNum < 0 && (baseBuyPrice === 0 || Ticker.Sell < baseBuyPrice * (1 - buyDynamicPoint - tp.Args.BuyFee))) {
		if(coinAmount <= tp.Args.MaxCoinLimit){
			//判断当前余额下可买入数量
			var canpay = (tp.Args.MaxCoinLimit - coinAmount) * Ticker.Sell;
			if(Account.Balance < canpay){
				canpay = Account.Balance;
			}
			var canbuy = canpay/Ticker.Sell;
			var operatefineness = buyDynamicPoint == tp.Args.BuyPoint ? tp.Args.OperateFineness : tp.Args.OperateFineness*(1+(avgPrice-Ticker.Sell)/avgPrice*buyDynamicPoint*100);
			opAmount = canbuy > operatefineness? operatefineness : canbuy;
			opAmount = _N(opAmount, tp.Args.StockDecimalPlace);
			if(opAmount > tp.Args.MinStockAmount){
				if(coinAmount <= tp.Args.MinStockAmount || baseBuyPrice === 0){
					if(debug) Log("程序运行之后或卖空之后第一次买入，以现价", Ticker.Sell, "，准备买入",opAmount,"个币。");
				}else{
					if(debug) Log("当前市价", Ticker.Sell, " < 买入点", parseFloat((baseBuyPrice * (1 - tp.Args.SellPoint - tp.Args.BuyFee)).toFixed(tp.Args.PriceDecimalPlace)), "，准备买入",opAmount,"个币。");
				}
				isOperated = true;
				_G(tp.Name+"_OperatingStatus",OPERATE_STATUS_BUY);
				var buyfee = opAmount*Ticker.Sell;
				Log("当前基准买入价格", baseBuyPrice, "上次买入价格", lastBuyPrice, "动态买入点", buyDynamicPoint, "当前持仓总量", coinAmount);
				Log(tp.Title+"交易对准备以",Ticker.Sell,"的价格买入",opAmount,"个币，当前账户余额为：",Account.Balance,"。本次下单金额",buyfee,"，本次预期买入数量",opAmount,"，预期成交价格",Ticker.Sell); 
				orderid = tp.Exchange.Buy(-1,buyfee);
			}else{
				if(debug) Log("当前有机会买入，但当前账户余额不足，已经不能再买进了。");
			}
		}else{
			if(debug) Log("当前持仓数量已经达到最大持仓量", tp.Args.MaxCoinLimit, "，不再买入，看机会卖出。");
		}
    } else if (crossNum > 0 && (coinAmount > tp.Args.MinCoinLimit+tp.Args.MinStockAmount && (Ticker.Buy > baseSellPrice * (1 + sellDynamicPoint + tp.Args.SellFee) || Ticker.Buy < historyHighPoint*0.85 && historyHighPoint/avgPrice > 1.50 && Ticker.Buy/avgPrice > 1.05 && (coinAmount-tp.Args.MinCoinLimit) > _G(tp.Name+"_lastBuycoinAmount")*0.3))) {
		var operatefineness = sellDynamicPoint == tp.Args.SellPoint ? tp.Args.OperateFineness : tp.Args.OperateFineness*(1+(Ticker.Buy-avgPrice)/avgPrice);
		opAmount = (coinAmount - tp.Args.MinCoinLimit) > operatefineness? operatefineness : _N((coinAmount - tp.Args.MinCoinLimit),tp.Args.StockDecimalPlace);
		if(coinAmount > tp.Args.MinCoinLimit && opAmount > tp.Args.MinStockAmount){
			if(debug) Log("当前市价", Ticker.Buy, " > 卖出点", parseFloat((baseSellPrice * (1 + tp.Args.SellPoint + tp.Args.SellFee)).toFixed(tp.Args.PriceDecimalPlace)), "，准备卖出",opAmount,"个币");
			isOperated = true;
			Log(tp.Title+"交易对准备以大约",Ticker.Buy,"的价格卖出",opAmount,"个币，当前持仓总量",coinAmount, "动态买入点", sellDynamicPoint, "baseSellPrice", baseSellPrice);
			_G(tp.Name+"_OperatingStatus",OPERATE_STATUS_SELL);
			orderid = tp.Exchange.Sell(-1, opAmount);
		}else{
			if(debug) Log("当前持仓数量小于最小持仓量", tp.Args.MinCoinLimit, "，没有币可卖，看机会再买入。");
		}
    } else {
    	var buytofull = checkCanBuytoFull(tp);
    	if(buytofull > 0){
			var canpay = (tp.Args.MaxCoinLimit - coinAmount) * Ticker.Sell;
			if(Account.Balance < canpay){
				canpay = Account.Balance;
			}
			var mustpay =  (costTotal+Account.Balance) * buytofull
			if(canpay < mustpay){
				mustpay = canpay;
			}
			Log(tp.Name+"交易对当前需要快速操作买入加仓到", buytofull,"，预计花费",mustpay);
			isOperated = true;
			_G(tp.Name+"_OperatingStatus",OPERATE_STATUS_BUY);
			orderid = tp.Exchange.Buy(-1,mustpay);    		
    	}else{
    		//如果当前K线发生了超过30%的超跌，后回升到开盘价的8成，就全平仓
    		var hourrecords = GetRecords(tp, PERIOD_H1);
    		var lastrecords = hourrecords[hourrecords.length -1];
    		var secondrecords = hourrecords[hourrecords.length -2];
    		if(!secondrecords) secondrecords = lastrecords;
    		if(coinAmount > tp.Args.MinCoinLimit+tp.Args.MinStockAmount && (lastrecords.High/lastrecords.Low > 1.3 && (lastrecords.Close - lastrecords.Low)/(lastrecords.High - lastrecords.Low) > 0.8 || secondrecords.High/secondrecords.Low > 1.3 && (lastrecords.Close - secondrecords.Low)/(secondrecords.High - secondrecords.Low) > 0.8) && Ticker.Buy/avgPrice > 1.02){
    			opAmount = coinAmount - tp.Args.MinCoinLimit;
    			isOperated = true;
				Log(tp.Title+"交易对当前发生了超过30%的超跌后回升超过8成，操作平仓");
				_G(tp.Name+"_OperatingStatus",OPERATE_STATUS_SELL);
				orderid = tp.Exchange.Sell(-1, opAmount);
    		}else{
		    	//当买入指导价为0时,看是否有必要操作买入指导价的重置，以增强买入活跃度
		    	if(lastBuyPrice == 0 && lastSellPrice > 0){
		    		//当前持仓量小于可卖仓量（最后买入持仓量-最小持仓量）的40%和价格已经回落到了上次卖出价头寸的4成，调整买入指导价为当前价格，以方便可以在相对合理的价格就开始开仓补货，这样可以抬高持仓均价，不至于一次遇到市场最低点之后以后再无法买入了
		    		var lastBuycoinAmount = _G(tp.Name+"_lastBuycoinAmount") ? _G(tp.Name+"_lastBuycoinAmount") : 0;
		    		if(stockValue/Account.Balance < 0.4 && coinAmount/lastBuycoinAmount < 0.4 && (Ticker.Sell-avgPrice)/(lastSellPrice-avgPrice) < 0.4){
		    			_G(tp.Name+"_LastBuyPrice", Ticker.Sell);
		    			if(debug) Log("且当前持仓量小于可卖仓量（最后买入持仓量-最小持仓量）的40%和价格已经回落到了上次卖出价头寸的4成，调整买入指导价为当前价格，以方便可以在相对合理的价格就开始开仓补货。");
		    		}
		    	}else if(lastBuyPrice > 0 && lastSellPrice == 0 && coinAmount<=tp.Args.MinCoinLimit+tp.Args.MinStockAmount){
		    		var goodbuyprice = (Ticker.Sell+avgPrice)/2;
		    		var loc = getInDayLineLocation(tp);
			    	if(goodbuyprice > lastBuyPrice && goodbuyprice <= (loc.High+loc.Low)/2){
						_G(tp.Name+"_LastBuyPrice", goodbuyprice);
						if(debug) Log("当前已经完成平仓，但币价继续上升，适当调整买入指导价以防止指导价过低无法买入。从",lastBuyPrice,"调到",goodbuyprice);
			    	}
		    	}
				if (crossNum < 0 ){
					if(debug) Log("价格没有下跌到买入点，继续观察行情...");
				}else{
					if(debug) Log("价格没有上涨到卖出点，继续观察行情...");
					//调整买入后的量高价格
					if(Ticker.Buy > historyHighPoint) _G(tp.Name+"_HistoryHighPoint", Ticker.Buy);
				}
    		}
    	}
    }
    //判断并输出操作结果
	if(isOperated){
		if (orderid) {
			_G(tp.Name+"_LastOrderId",orderid);
			_G(tp.Name+"_BeforeBuyingStocks",coinAmount);
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
			rows.push(['MinStockAmount','限价单最小交易数量', tp.Args.MinStockAmount]);		
			rows.push(['BuyPoint','买入点', tp.Args.BuyPoint]);		
			rows.push(['SellPoint','卖出点', tp.Args.SellPoint]);		
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
		accounttable2.cols = ['交易对','买入次数','卖出次数','总交易次数','累计收益','调试','添加时间','最后更新'];
		rows = [];
		for(var r=0;r<TradePairs.length;r++){
			var tp = TradePairs[r];
			rows.push([tp.Title, _G(tp.Name+"_BuyTimes"), _G(tp.Name+"_SellTimes"), (_G(tp.Name+"_BuyTimes")+_G(tp.Name+"_SellTimes")), _G(tp.Name+"_SubProfit"), _G(tp.Name+"_Debug"), _G(tp.Name+"_AddTime"), tp.LastUpdate]);
		}
		accounttable2.rows = rows;
		accounttables.push(accounttable2);
		var accounttable3 = {};
		accounttable3.type="table";
		accounttable3.title = "短线卖出挂单";
		accounttable3.cols = ['交易对','买入价','卖出价','当前币价','交易量','订单编号','挂单时间'];
		rows = [];
		for(var r=0;r<TradePairs.length;r++){
			var tp = TradePairs[r];
			var s = tp.Ssst;
			if(s){
				rows.push([tp.Title, s.BuyPrice, s.SellPrice, tp.TPInfo.TickerLast, s.Amount, s.OrderID, _D(s.OrderTime)]);
			}else{
				rows.push([tp.Title, '-', '-', '-', '-', '-', '-']);
			}
		}
		accounttable3.rows = rows;
		accounttables.push(accounttable3);
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
				accounttable2.rows[r] =[nowtp.Title, _G(nowtp.Name+"_BuyTimes"), _G(nowtp.Name+"_SellTimes"), (_G(nowtp.Name+"_BuyTimes")+_G(nowtp.Name+"_SellTimes")), _G(nowtp.Name+"_SubProfit"), _G(nowtp.Name+"_Debug"), _G(nowtp.Name+"_AddTime"), nowtp.LastUpdate];
				break;
			}	
		}		
		var accounttable3 = AccountTables[2];
		for(var r=0;r<accounttable3.rows.length;r++){
			if(nowtp.Title == accounttable3.rows[r][0]){
				var s = nowtp.Ssst;
				if(s) accounttable3.rows[r] =[nowtp.Title, s.BuyPrice, s.SellPrice, nowtp.TPInfo.TickerLast, s.Amount, s.OrderID, s.OrderTime === 0 ? 0 : _D(s.OrderTime)];
				break;
			}	
		}		
	}
	LogStatus("`" + JSON.stringify(ArgTables)+"`\n`" + JSON.stringify(AccountTables)+"`\n 策略累计收益："+ _G("TotalProfit")+ "\n 策略启动时间："+ StartTime + " 累计刷新次数："+ TickTimes + " 最后刷新时间："+ _D());	
}

function main() {
	Log("开始执行主事务程序...");  
	while (true) {
		if(TradePairs.length){
			LastRecords = {"DayRecords":null,"HourRecords":null};
			//策略交互处理函数
			commandProc();
			//获取当前交易对
			var tp = TradePairs[NowTradePairIndex];
			if(_G(tp.Name+"_Debug") == "1") Log("开始操作",tp.Title,"交易对...");
			//设置小数位，第一个为价格小数位，第二个为数量小数位
			tp.Exchange.SetPrecision(tp.Args.PriceDecimalPlace, tp.Args.StockDecimalPlace);
			//短线交易处理
			ssstHandle(tp);
			//操作长线交易
			if(!onTick(tp)) break;
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