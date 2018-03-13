/**************************************
多交易对现货长线量化价值投资策略V1.0
说明：因为多个交易对收益合并到一个曲线，所以同一个机器人使用的基础货币要是一样的。
1.设定一个币种最小持仓量和最大持仓量
2.当行情处于下降通道，且市场价格低于当前持仓平均价格或上一次买入的价格时，买入设定的操作粒度，直到最大持仓量
3.当行情处于上升通道，且市场价格高于当前持仓平均价格或上一次卖出的价格时，卖出设定的操作粒度，直到最小持仓量，当到达最小持仓量的时候，平均价格清0，使得程序可以重新买入新量。
4.均线周期使用1小时均线，频率为1分钟。
5.最小持仓量的币是用来增值的，最小持仓量到最大持仓量之间的币是用来获利的。可以定期根据盈利情况来调整这两个值，以加大持仓或减少
6.本策略为价值投资策略，目的是可以在市场低迷的时候吃进持仓，市场行情好的时候出货套一定的现。
  不追求短线高频交易，而是在一定时间内的大跌大涨中拥获价值投资的机会使得持仓平均价格不断的降低,并使得最小持仓量的币保持最低的价格，等币价升值。
7.即然是价值投资，选币就很重要的，一定要选有投资价值的币种，不要是那种一跌不起的币
8.本策略在大跌大涨行情中效果最好，涨跌互现或是跌得很深的情况下，只要子弹够多，那么可以拿到很多便宜的货，以前我们人为操作的时候，总是会出现
  以为行情已经到底了，所以大举买入，但是谁知被套在一个相对高位了。此策略以每次操作的粒度进行限制，以使得每次不会全仓进入，这样可以有更多的
  机会可以拿到更便宜的货。
9.程序使用了机器人的本地存储，暂停和重启机器人不会影响保存的数据，但是如果新建机器人需要手动计算当前帐户的持仓均价并填入参数当中。

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
}
var TradePairs = [];	//所有交易对数组
var NowTradePairIndex = 0;		//当前的交易所对索引
var TotalProfit = 0;	//策略累计收益
var StartTime = _D();	//策略启动时间
var TickTimes = 0;		//刷新次数
var ArgTables;		//已经处理好的用于显示的参数表，当参数更新时置空重新生成，以加快刷新速度
var AccountTables;	//当前的账户信息表，如果当前已经有表，只要更新当前交易对，这样可以加快刷新速度，减少内存使用

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
		Log(tp.Name,"交易对参数：最大持仓量为0，必须填写此字段。");
		ret = false;
	}
	if(a.OperateFineness === 0){
		Log(tp.Name,"交易对参数：买卖操作的粒度为0，必须填写此字段。");
		ret = false;
	}
	if(a.BuyFee === 0 || a.SellFee === 0){
		Log(tp.Name,"交易对参数：平台买卖手续费为0，必须填写此字段。");
		ret = false;
	}
	if(a.PriceDecimalPlace === 0 || a.StockDecimalPlace === 0){
		Log(tp.Name,"交易对参数：交易对价格/数量小数位为0，必须填写此字段。");
		ret = false;
	}
	if(a.MinStockAmount === 0){
		Log(tp.Name,"交易对参数：限价单最小交易数量为0，必须填写此字段。");
		ret = false;
	}
	if(a.BuyPoint === 0){
		Log(tp.Name,"交易对参数：指导买入点为0，必须填写此字段。");
		ret = false;
	}
	if(a.SellPoint === 0){
		Log(tp.Name,"交易对参数：指导卖出点为0，必须填写此字段。");
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

	Log("启动多交易对现货长线量化价值投资策略程序...");  

	//初始化存储变量
	if(!_G("TotalProfit")) _G("TotalProfit",0);

	//解析JSON参数
	parseArgsJson(Json);
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
function Cross(tp, a, b) {
	var MAType = 0;
    var pfnMA = [TA.EMA, TA.MA, talib.KAMA][MAType];
    var crossNum = 0;
    var arr1 = [];
    var arr2 = [];
    if (Array.isArray(a)) {
        arr1 = a;
        arr2 = b;
    } else {
        var records = null;
        while (true) {
            records = tp.Exchange.GetRecords();
            if (records && records.length > a && records.length > b) {
                break;
            }
            Sleep(1000);
        }
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
	var profit = parseFloat((order.AvgPrice*order.DealAmount*(1-tp.Args.SellFee) - avgPrice*order.DealAmount*(1+tp.Args.BuyFee)).toFixed(tp.Args.PriceDecimalPlace));
	SubProfit += profit;
	TotalProfit += profit;
	tp.Profit = SubProfit;
	_G(tp.Name+"_SubProfit", SubProfit);
	_G("TotalProfit", TotalProfit);
	LogProfit(TotalProfit);
	
	if(order.DealAmount === order.Amount ){
		Log(tp.Title,"交易对订单",_G(tp.Name+"_LastOrderId"),"交易成功!平均卖出价格：",order.AvgPrice,"，平均持仓价格：",avgPrice,"，卖出数量：",order.DealAmount,"，毛收盈：",profit,"，累计毛收盈：",TotalProfit);
	}else{
		Log(tp.Title,"交易对订单",_G(tp.Name+"_LastOrderId"),"部分成交!卖出数量：",order.DealAmount,"，剩余数量：",order.Amount - order.DealAmount,"，平均卖出价格：",order.AvgPrice,"，平均持仓价格：",avgPrice,"，毛收盈：",profit,"，累计毛收盈：",TotalProfit);
	}
	
	//设置最后一次卖出价格
	if(order.DealAmount>(order.Amount/2)){
		_G(tp.Name+"_LastSellPrice",order.AvgPrice);
	}
	
	//如果当前持仓数量小于最小交量数量时，价格重置为0，方便短线操作
	var coinAmount = getAccountStocks(account); //从帐户中获取当前持仓信息
	if(coinAmount <= tp.Args.MinStockAmount){
		var newAvgPrive = parseFloat(((order.AvgPrice+avgPrice)/2).toFixed(tp.Args.PriceDecimalPlace));
		Log(tp.Title,"交易对成功空仓持币，将指导买入价从原持仓均价",avgPrice,"调整为",newAvgPrive);
		_G(tp.Name+"_AvgPrice",newAvgPrive);
		_G(tp.Name+"_LastBuyPrice",0);
		_G(tp.Name+"_LastSellPrice",0);
	}
	
	//列新交易次数
	var tradeTimes = _G(tp.Name+"_SellTimes");
	tradeTimes++;
	_G(tp.Name+"_SellTimes",tradeTimes);
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
	var coinAmount = getAccountStocks(account);
	
	//计算持仓总价
	var Total = parseFloat((avgPrice*(coinAmount-order.DealAmount*(1-tp.Args.BuyFee))+order.AvgPrice * order.DealAmount).toFixed(tp.Args.PriceDecimalPlace));
	
	//计算并调整平均价格
	avgPrice = parseFloat((Total / coinAmount).toFixed(tp.Args.PriceDecimalPlace));
	_G(tp.Name+"_AvgPrice",avgPrice);
	
	if(order.DealAmount === order.Amount ){
		Log(tp.Title,"交易对买入订单",_G(tp.Name+"_LastOrderId"),"交易成功!成交均价：",order.AvgPrice,"，数量：",order.DealAmount,"，持仓价格调整到：",avgPrice,"，总持仓数量：",coinAmount,"，总持币成本：",Total);			
	}else{
		Log(tp.Title,"交易对买入订单",_G(tp.Name+"_LastOrderId"),"部分成交!成交均价：",order.AvgPrice,"，数量：",order.DealAmount,"，持仓价格调整到：",avgPrice,"，总持仓数量：",coinAmount,"，总持币成本：",Total);			
	}
	
	//设置最后一次买入价格,仅在买入量超过一半的情况下调整最后买入价格，没到一半继续买入
	if(order.DealAmount>(order.Amount/2)){
		_G(tp.Name+"_LastBuyPrice",order.AvgPrice);
	}
					
	//判断是否更新了历史最低持仓价
	var historyMinPrice = _G(tp.Name+"_HistoryMinPrice") ? _G(tp.Name+"_HistoryMinPrice") : 0;
	if(avgPrice < historyMinPrice){
		Log(tp.Title,"交易对当前持仓均价达到历史最低持仓均价",avgPrice,"，更新最低持仓均价。");
		_G(tp.Name+"_HistoryMinPrice",avgPrice);
	}
	
	//列新交易次数
	var tradeTimes = _G(tp.Name+"_BuyTimes");
	tradeTimes++;
	_G(tp.Name+"_BuyTimes",tradeTimes);

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
function commandProc(coinAmount){
    var cmd=GetCommand();
	if(cmd){
		var cmds=cmd.split(":");
		var values;
		var tp;
		if(cmds.length === 2){
			values = cmds[1].split("|");
			if(values.length === 2 && values[0].toUpperCase() != "ALL"){
				tp = getTradePair(values[0]);
				if(!tp){
					Log("没有取到相应的交易对，请确认交易对名称的正确性，格式为交易所名_交易对名!。 #FF0000");
					return;
				}
			}else{
				Log("提交的交互内容格式不正式，格式为_|_!。 #FF0000");
				return;
			}
			if(cmds[0] == "NewAvgPrice" && tp){
				if(coinAmount > tp.Args.MinStockAmount && values[1] == 0){
					Log(tp.Name,"当前有持仓币数，但没有尝试更新持仓价格为0，拒绝操作！！！");
				}else{
					Log(tp.Name,"更新持仓价格为",values[1]);
					tp.Args.NowCoinPrice = values[1];
					_G(tp.Name+"_AvgPrice",values[1]);
					ArgTables = null;
					AccountTables = null;
				}
			}else if(cmds[0] == "GuideBuyPrice" && tp){
				if(coinAmount > tp.Args.MinStockAmount && values[1] == 0){
					Log(tp.Name,"当前有持仓币数，但不能设置价格为0的指导价格！！！");
				}else{
					Log(tp.Name,"更新指导买入价格为",values[1]);
					_G(tp.Name+"_LastBuyPrice",values[1]);
					AccountTables = null;
				}
			}else if(cmds[0] == "NewBuyPoint" && tp){
				if(cmds[1] <= tp.Args.BuyFee){
					Log(tp.Name,"输入的买入点数小于平台交易费，请确认参数是否正确！！！");
				}else if(cmds[1] > 0.5){
					Log(tp.Name,"输入的买入点数过大可能无法成交，请确认参数是否正确！！！");
				}else{
					if(values[0].toUpperCase() == "ALL"){
						for(var i=0;i<TradePairs.length;i++){
							TradePairs[i].Args.BuyPoint = values[1];
						}
						Log("更新所有交易对买入点数为",values[1]," #FF0000");
					}else{
						Log(tp.Name,"更新买入点数为",values[1]);
						tp.Args.BuyPoint = values[1];
					}
					ArgTables = null;
				}
			}else if(cmds[0] == "NewSellPoint" && tp){
				if(cmds[1] <= tp.Args.SellFee){
					Log(tp.Name,"输入的卖出点数小于平台交易费，请确认参数是否正确！！！");
				}else{
					if(values[0].toUpperCase() == "ALL"){
						for(var i=0;i<TradePairs.length;i++){
							TradePairs[i].Args.SellPoint = values[1];
						}
						Log("更新所有交易对卖出点数为",values[1]," #FF0000");
					}else{
						Log(tp.Name,"更新卖出点数为",values[1]);
						tp.Args.SellPoint = values[1];
					}
					ArgTables = null;
				}
			}else if(cmds[0] == "Debug" && cmds[1].length>0){
				if(values[0].toUpperCase() == "ALL"){
					for(var i=0;i<TradePairs.length;i++){
						_G(tp.Name+"_Debug",values[1]);
					}
					Log("更新所有交易对调试状态为",values[1]," #FF0000");
				}else{
					if(tp){
						_G(tp.Name+"_Debug",values[1]);
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

//定时任务，主业务流程 
function onTick(tp) {
	var debug = _G(tp.Name+"_Debug") == "1" ? true : false;
	//获取实时信息
	var Account = GetAccount(tp);
    var Ticker = GetTicker(tp);
	var stockValue = parseFloat(((Account.Stocks+Account.FrozenStocks)*Ticker.Last).toFixed(tp.Args.PriceDecimalPlace));
	if(debug) Log("账户余额", parseFloat(Account.Balance).toFixed(8), "，冻结余额", parseFloat(Account.FrozenBalance).toFixed(8), "，可用币数", parseFloat(Account.Stocks).toFixed(8), "，冻结币数", parseFloat(Account.FrozenStocks).toFixed(8) , "，当前持币价值", stockValue);
	//处理持仓价格变量
    var coinAmount = getAccountStocks(Account); //从帐户中获取当前持仓信息
	//策略交互处理函数
	commandProc(coinAmount);
	
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
	//获取当前均价
	var avgPrice = _G(tp.Name+"_AvgPrice");
	if(!avgPrice){
		//平均价格为空或0，说明新启动，尝试从参数读入并写入存储
		avgPrice = tp.Args.NowCoinPrice;
		_G(tp.Name+"_AvgPrice",avgPrice);
	}
	if(coinAmount > tp.Args.MinStockAmount && avgPrice === 0){
		Log(tp.Name+"交易对账户有持币，但是输入的均价为0，请确认参数！！ #FF0000");
		return false;
	}
    var lastBuyPrice = _G(tp.Name+"_LastBuyPrice") ? _G(tp.Name+"_LastBuyPrice") : 0;
    var lastSellPrice = _G(tp.Name+"_LastSellPrice") ? _G(tp.Name+"_LastSellPrice") : 0;
	var historyMinPrice = _G(tp.Name+"_HistoryMinPrice") ? _G(tp.Name+"_HistoryMinPrice") : 0;
    var costTotal = parseFloat((avgPrice*coinAmount).toFixed(tp.Args.PriceDecimalPlace));	//从帐户中获取当前持仓信息和平均价格算出来
	var opAmount = 0;
    var orderid = 0;
	var isOperated = false;	
	if(debug) Log("历史最低均价", historyMinPrice, "，当前持仓均价", avgPrice, "，持币数量", _N(coinAmount,tp.Args.StockDecimalPlace), "，上一次买入", lastBuyPrice, "，上一次卖出", lastSellPrice, "，总持币成本", costTotal);

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
		LastSellPrice:lastSellPrice	//上一次卖出
	};
	tp.TPInfo = tpInfo; 

	//获取行情数据
    var crossNum = Cross(tp, 5, 15);
    if (crossNum > 0) {
        if(debug) Log("当前交叉数为", crossNum, ",处于上升通道");
    } else {
        if(debug) Log("当前交叉数为", crossNum, ",处于下降通道");
    }
    var baseBuyPrice = lastBuyPrice ? lastBuyPrice : avgPrice;
    var baseSellPrice = lastSellPrice ? lastSellPrice : avgPrice;
    if(debug) Log("当前基准买入价格=", baseBuyPrice, "，当前基准卖出价格=", baseSellPrice, "，买入点", tp.Args.BuyPoint, "，当前币价", Ticker.Sell);
    if (crossNum < 0 && (baseBuyPrice ===0 || Ticker.Sell < baseBuyPrice * (1 - tp.Args.BuyPoint - tp.Args.BuyFee))) {
		if(coinAmount <= tp.Args.MaxCoinLimit){
			//判断当前余额下可买入数量
			var canpay = (tp.Args.MaxCoinLimit - coinAmount) * Ticker.Sell;
			if(Account.Balance < canpay){
				canpay = Account.Balance;
			}
			var canbuy = canpay/Ticker.Sell;
			opAmount = canbuy > tp.Args.OperateFineness? tp.Args.OperateFineness : canbuy;
			opAmount = _N(opAmount, tp.Args.StockDecimalPlace);
			if(opAmount > tp.Args.MinStockAmount){
				if(coinAmount <= tp.Args.MinStockAmount || baseBuyPrice === 0){
					if(debug) Log("程序运行之后或卖空之后第一次买入，以现价", Ticker.Sell, "，准备买入",opAmount,"个币。");
				}else{
					if(debug) Log("当前市价", Ticker.Sell, " < 买入点", parseFloat((baseBuyPrice * (1 - tp.Args.SellPoint - tp.Args.BuyFee)).toFixed(tp.Args.PriceDecimalPlace)), "，准备买入",opAmount,"个币。");
				}
				isOperated = true;
				_G(tp.Name+"_OperatingStatus",OPERATE_STATUS_BUY);
				orderid = tp.Exchange.Buy(Ticker.Sell, opAmount);
				Log(tp.Title+"交易对准备以",Ticker.Sell,"的价格买入",opAmount,"个币。");
			}else{
				if(debug) Log("当前有机会买入，但当前账户余额不足，已经不能再买进了。");
			}
		}else{
			if(debug) Log("当前持仓数量已经达到最大持仓量", tp.Args.MaxCoinLimit, "，不再买入，看机会卖出。");
			_G("ToTheBiggest", true);
		}
    } else if (crossNum > 0 && Ticker.Buy > baseSellPrice * (1 + tp.Args.SellPoint + tp.Args.SellFee)) {
		opAmount = (coinAmount - tp.Args.MinCoinLimit) > tp.Args.OperateFineness? tp.Args.OperateFineness : _N((coinAmount - tp.Args.MinCoinLimit),tp.Args.StockDecimalPlace);
		if(coinAmount > tp.Args.MinCoinLimit && opAmount > tp.Args.MinStockAmount){
			if(debug) Log("当前市价", Ticker.Buy, " > 卖出点", parseFloat((baseSellPrice * (1 + tp.Args.SellPoint + tp.Args.SellFee)).toFixed(tp.Args.PriceDecimalPlace)), "，准备卖出",opAmount,"个币");
			isOperated = true;
			_G(tp.Name+"_OperatingStatus",OPERATE_STATUS_SELL);
			orderid = tp.Exchange.Sell(Ticker.Buy, opAmount);
			Log(tp.Title+"交易对准备以",Ticker.Buy,"的价格卖出",opAmount,"个币。");
		}else{
			if(debug) Log("当前持仓数量小于最小持仓量", tp.Args.MinCoinLimit, "，不能卖出，看机会再买入。");

			if(_G(tp.Name+"_ToTheBiggest")){
				if(debug) Log("当前持仓数量已经达到最大持仓量后再次达到最小持仓量，这种情况下重置平均持仓价格，以使得之后有条件买入。");
				_G(tp.Name+"_AvgPrice",Ticker.Buy);
				_G(tp.Name+"_ToTheBiggest",false);
			}
		}
    } else {
		if (crossNum < 0 ){
			if(debug) Log("价格没有下跌到买入点，继续观察行情...");
		}else{
			if(debug) Log("价格没有上涨到卖出点，继续观察行情...");
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
		accounttable1.title = "交易对状态信息";
		accounttable1.cols = ['交易对','买入次数','卖出次数','总交易次数','累计收益','调试','添加时间','最后更新'];
		var rows = [];
		for(var r=0;r<TradePairs.length;r++){
			var tp = TradePairs[r];
			rows.push([tp.Title, _G(tp.Name+"_BuyTimes"), _G(tp.Name+"_SellTimes"), (_G(tp.Name+"_BuyTimes")+_G(tp.Name+"_SellTimes")), _G(tp.Name+"_SubProfit"), _G(tp.Name+"_Debug"), _G(tp.Name+"_AddTime"), tp.LastUpdate]);
		}
		accounttable1.rows = rows;
		accounttables.push(accounttable1);
		var accounttable2 = {};
		accounttable2.type="table";
		accounttable2.title = "交易对价格信息";
		accounttable2.cols = ['交易对', '余额', '冻结余额', '可用币数', '冻结币数','持仓均价','持仓成本','当前币价','持币价值','上次买入价','上次卖出价'];
		rows = [];
		for(var r=0;r<TradePairs.length;r++){
			var tp = TradePairs[r];
			var i = tp.TPInfo;
			rows.push([tp.Title, parseFloat(i.Balance).toFixed(8), parseFloat(i.FrozenBalance).toFixed(8), parseFloat(i.Stocks).toFixed(8), parseFloat(i.FrozenStocks).toFixed(8), i.AvgPrice, i.CostTotal, 
			i.TickerLast, i.StockValue,  parseFloat(i.LastBuyPrice).toFixed(tp.Args.PriceDecimalPlace),  parseFloat(i.LastSellPrice).toFixed(tp.Args.PriceDecimalPlace)]);
		}
		accounttable2.rows = rows;
		accounttables.push(accounttable2);
		AccountTables = accounttables;
	}else{
		var accounttable1 = AccountTables[0];
		for(var r=0;r<accounttable1.rows.length;r++){
			if(nowtp.Title == accounttable1.rows[r][0]){
				accounttable1.rows[r] =[nowtp.Title, _G(nowtp.Name+"_BuyTimes"), _G(nowtp.Name+"_SellTimes"), (_G(nowtp.Name+"_BuyTimes")+_G(nowtp.Name+"_SellTimes")), _G(nowtp.Name+"_SubProfit"), _G(nowtp.Name+"_Debug"), _G(nowtp.Name+"_AddTime"), nowtp.LastUpdate];
				break;
			}	
		}
		var accounttable2 = AccountTables[1];
		for(var r=0;r<accounttable2.rows.length;r++){
			if(nowtp.Title == accounttable2.rows[r][0]){
				var i = nowtp.TPInfo;
				accounttable2.rows[r] =[nowtp.Title, parseFloat(i.Balance).toFixed(8), parseFloat(i.FrozenBalance).toFixed(8), parseFloat(i.Stocks).toFixed(8), parseFloat(i.FrozenStocks).toFixed(8), i.AvgPrice, i.CostTotal, 
			i.TickerLast, i.StockValue,  parseFloat(i.LastBuyPrice).toFixed(nowtp.Args.PriceDecimalPlace), parseFloat(i.LastSellPrice).toFixed(nowtp.Args.PriceDecimalPlace)];
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
			//获取当前交易对
			var tp = TradePairs[NowTradePairIndex];
			if(_G(tp.Name+"_Debug") == "1") Log("开始操作",tp.Title,"交易对...");
			//设置小数位，第一个为价格小数位，第二个为数量小数位
			tp.Exchange.SetPrecision(tp.Args.PriceDecimalPlace, tp.Args.StockDecimalPlace);
			//操作交易
			if(!onTick(tp)) break;
			//操作状态显示
			tp.LastUpdate = _D();
			showStatus(tp);
			//控制轮询
            NowTradePairIndex = NowTradePairIndex === TradePairs.length-1 ? 0 : NowTradePairIndex+1;
            var interval = 60/TradePairs.length;
			if(interval < 5) interval = 5;
            Sleep(interval * 1000);
		}else{
			Log("匹配的交易对为空，请提供正常的交易对参数JSON内容。");
			break;
		}
	}
}