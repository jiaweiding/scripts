/**************************************
脚本名称：ZSJ任务
脚本作者：@jiaweiding
更新日期：2024-07-30 09:55:56
------------------------------------------

2024.10.03 放在私有仓库，新增任务组

重写：打开ZSJ APP，进入我的页面.

[task_local]
12 12 8,9 * * * https://gist.githubusercontent.com/jiaweiding/93269a9f63229bc63227719f2c24a906/raw/94f2de472703a34cd5cdc60af16b34723317bbee/zsj.js, tag=ZSJ签到, img-url=https://raw.githubusercontent.com/Koolson/Qure/master/IconSet/Color/Apple.png, enabled=true

[rewrite_local]
^https:\/\/zuser\.cztv\.com\/api\/uc\/userInfo url script-request-header zsj.js

[MITM]
hostname = zuser.cztv.com

******************************************/

// env.js 全局
const $ = new Env("ZSJ任务");
const COOKIE_NAME = "zsj_data";
const APP_VERSION = "6.1.3"
const SIGN_IN_KEY = 'lastSignInTime';

//调试
$.is_debug = 'true';
let userCookie = $.getdata(COOKIE_NAME) || {};
let pointCount = 0;

const behavior_zone_ids = { 28: 7, 29: 7, 30: 7, 31: 7, 40: 9, 41: 9, 42: 9, 34: 7, 36: 9, 35: 9, 32: 7, 38: 9, 37: 9, 39: 9 };

// 为通知准备的空数组
$.notifyMsg = [];

// 脚本入口
async function main() {
    try {
        $.log(`🎉 开始执行任务`);
        // 如果没有签到才去
        if (!Tools.hasSignedInToday()) {
            $.log(`✅ 今天还没有签到，开始签到`);
            await signCheckin();
        } else {
            $.log(`❎ 今天已经签到过了，跳过签到`);
        }

        // 获取最新的任务
        let task = await getDailyTasks()
        let processTypeInt = parseInt(task.extra.process_type);
        if (processTypeInt === 4) {
            await performTask(task);
        } else {
            await performWatchTask(task);
        }

    } catch (e) {
    } finally {
        let message = $.notifyMsg.join('\n');
        if (message.trim()) {
            // 检查 message 是否有非空白字符
            $.msg($.name, '', message);
        }
        $.notifyMsg = [];
    }
}

//获取Cookie
async function getCookie() {
    if ($request && $request.method != 'OPTIONS') {
        let sessionId = "";
        if ($.isLoon()) {
            sessionId = $request.headers["sessionid"];
        } else if ($.isQuanX()) {
            sessionId = $request.headers["sessionId"];
        }

        //不存在sessionId时
        if (!sessionId) {
            return $.msg($.name, "❌获取sessionId失败！")
        }

        if (userCookie === sessionId) {
            $.log(`Cookie已存在: ${userCookie}`, "用户信息");
            return;
        }

        // 用户信息获取
        let { nickName, avatar, mobile } = await getUserInfo(sessionId) ?? {};
        $.log(`Name: ${nickName}, Avatar: ${avatar}, Mobile: ${mobile}`, "用户信息");

        // 缓存用户信息
        let cookie = sessionId
        $.setdata(cookie, COOKIE_NAME);
        $.msg($.name, `🎉${mobile}获取sessionId成功，值为${sessionId}`, '');
    }
}

// 获取用户信息 - 可以没有
async function getUserInfo(sessionId) {
    const tsString = Tools.ts13();
    const options = {
        url: `https://zuser.cztv.com/api/uc/userInfo`,
        headers: {
            'User-Agent': `cztvVideoiPhone/${APP_VERSION} (iPhone; iOS 16.7; Scale/3.00)`,
            'Content-Type': 'application/json',
            'Accept-Encoding': 'gzip, deflate, br',
            'chn': 'App Store',
            'sessionId': sessionId,
            'ver': APP_VERSION,
        },
        body: JSON.stringify({
            sign: Tools.lanHeSHA256({ 'ts': tsString }),
            ts: tsString
        })

    };

    return new Promise(resolve => {
        $.post(options, async (error, response, data) => {
            try {
                let result = JSON.parse(data).data;
                $.log("result: " + JSON.stringify(result));
                resolve(result);
            } catch (error) {
                $.log(error);
                resolve();
            }
        });
    });
}

// 签到
async function signCheckin() {
    $.log(`⏰ 开始执行签到任务\n`)
    let ts = Tools.ts10();
    let sessionId = userCookie;
    let nonce = Tools.randomStringWithLength(16);
    let singature = Tools.signature(sessionId, nonce, ts);
    const options = {
        url: "https://zvip.cztv.com/api/app/signIns/1/finishSignIn",
        headers: {
            'X-Requested-With': 'XMLHttpRequest',
            'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148/chinabluetv',
            'Content-Type': 'application/json',
            'timestamp': ts,
            'nonce': nonce,
            'UserSession': sessionId,
            'appKey': "fkqynd733a322d622c243a3220722c213a3221622b7phwzq",
            'signature': singature,
        },
        body: JSON.stringify({})
    }
    //post方法
    let res = await httpRequest(options);
    if (res.message) {
        $.log(`${res.message}`);
        $.notifyMsg.push(res.message);
        return;
    }

    let amount = data.sign_item.extra.rewards[0].amount;
    pointCount = pointCount + amount;
    const successMsg = `签到成功，奖励: ${amount} 积分`;
    Tools.setLastSignInTime();
    $.log(successMsg);
    $.notifyMsg.push(successMsg);
}


// 获取日常任务列表
async function getDailyTasks() {
    $.log(`\n1️⃣ 开始执行查询日常任务列表`)
    let ts = Tools.ts10();
    let sessionId = userCookie;
    let nonce = Tools.randomStringWithLength(16);
    let singature = Tools.signature(sessionId, nonce, ts);
    const options = {
        url: "https://zvip.cztv.com/api/point/getMultiTaskList?task_zone_id=22&pageSize=50",
        headers: {
            'X-Requested-With': 'XMLHttpRequest',
            'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148/chinabluetv',
            'Content-Type': 'application/json',
            'timestamp': ts,
            'nonce': nonce,
            'UserSession': sessionId,
            'appKey': "fkqynd733a322d622c243a3220722c213a3221622b7phwzq",
            'signature': singature,
        }
    }

    //post方法
    let res = await httpRequest(options, 'get');
    let tasks = res.data[0].tasks ?? [];

    // 使用filter方法过滤数组
    let filteredTasks = tasks.filter(task => {
        // 检查task.name是否包含"新用户"
        const nameCondition = !task.name.includes("新用户");
        // 检查task.extra.url是否包含"invitefriend"
        const urlCondition = !task.extra.url.includes("invitefriend");
        // 检查finished_today是否小于daily_limit
        const limitCondition = parseInt(task.finished_today) < parseInt(task.extra.daily_limit);
        // 只有当所有条件都为true时，才保留该任务
        return nameCondition && urlCondition && limitCondition;
    });


    // 获取第一个没有上报的任务
    if (filteredTasks.length === 0) {
        const msg = `任务已全部完成，请明天再来~`;

        $.log(msg)
        $.notifyMsg.push(msg);
        return;
    }

    let firstTaskWithStatusOne = filteredTasks[0];
    $.log(`现在执行的数据 -> id: ${firstTaskWithStatusOne.id} name: ${firstTaskWithStatusOne.name}`)
    return firstTaskWithStatusOne;
}

// 执行任务
async function performTask(task) {
    let name = task.name;
    let behavior_rule_id = task.behavior_rule_id;
    let task_zone_id = behavior_zone_ids[behavior_rule_id];
    let amount = task.extra.rewards[0].amount;
    $.log(`\n2️⃣ 开始执行${name}任务\n`);

    let ts = Tools.ts10();
    let sessionId = userCookie;
    let nonce = Tools.randomStringWithLength(16);
    let singature = Tools.signature(sessionId, nonce, ts, "a1a2f66785721decc112da38c13dd967");
    const options = {
        url: "https://zvip.cztv.com/api/point/operatePointByUserBehavior",
        headers: {
            'User-Agent': `cztvVideoiPhone/${APP_VERSION} (iPhone; iOS 17.5.1; Scale/3.00)`,
            'Content-Type': 'application/json',
            'Accept-Encoding': 'gzip, deflate, br',
            'Content-Type': 'application/json',
            'timestamp': ts,
            'nonce': nonce,
            'UserSession': sessionId,
            'appKey': "ktd69d723a3220722c213a3221622b7gospk",
            'signature': singature,
        },
        body: JSON.stringify({
            'behavior_id': behavior_rule_id,
            'behavior_zone_id': task_zone_id,
        })
    }
    $.log(`options: ${JSON.stringify(options)}`);

    let responseData = await httpRequest(options);
    $.log(`responseData: ${JSON.stringify(responseData)}`);

    if (responseData.message === "操作成功") {
        pointCount = pointCount + amount;
        const successMsg = `完成任务"${name}"，奖励: ${amount} 积分`;
        $.log(successMsg);
        $.notifyMsg.push(successMsg);
    } else {
        const errorMsg = `"${name}" 任务失败: ${responseData.message}`;
        $.log(errorMsg);
        $.notifyMsg.push(errorMsg);
    }
}

async function performWatchTask(task) {
    let name = task.name;
    let amount = task.extra.rewards[0].amount;
    $.log(`\n3️⃣ 开始执行${name}任务\n`)

    let ts = Tools.ts10();
    let sessionId = userCookie;
    let nonce = Tools.randomStringWithLength(16);
    let singature = Tools.signature(sessionId, nonce, ts, "a1a2f66785721decc112da38c13dd967");
    const options = {
        url: "https://zvip.cztv.com/api/point/finishTask",
        headers: {
            'User-Agent': `cztvVideoiPhone/${APP_VERSION} (iPhone; iOS 17.5.1; Scale/3.00)`,
            'Content-Type': 'application/json',
            'Accept-Encoding': 'gzip, deflate, br',
            'Content-Type': 'application/json',
            'timestamp': ts,
            'nonce': nonce,
            'UserSession': sessionId,
            'appKey': "ktd69d723a3220722c213a3221622b7gospk",
            'signature': singature,
        },
        body: JSON.stringify({
            'task_id': task.id
        })
    }

    let responseData = await httpRequest(options);
    if (responseData.message === "操作成功") {
        pointCount += amount;
        const successMsg = `完成任务 "${name}"，奖励: ${amount} 积分`;
        $.log(successMsg);
        $.notifyMsg.push(successMsg);
    } else {
        const errorMsg = `"${name}" 任务失败: ${responseData.message}`;
        $.log(errorMsg);
        $.notifyMsg.push(errorMsg);
    }
}

async function loadModule() {
    //Jsrsasign模块
    $.CryptoJS = await loadCryptoJS();
    return $.CryptoJS ? true : false;
}

//加载CryptoJS模块
async function loadCryptoJS() {
    let code = ($.isNode() ? require('crypto-js') : $.getdata('CryptoJS_code')) || '';
    //node环境
    if ($.isNode()) return code;

    //ios环境
    if (code && Object.keys(code).length) {
        $.log(`✅ ${$.name}: 缓存中存在CryptoJS代码, 跳过下载\n`)
        eval(code)
        return createCryptoJS();
    }
    $.log(`🚀 ${$.name}: 开始下载CryptoJS代码`)
    return new Promise(async (resolve) => {
        $.getScript(
            'https://cdn.jsdelivr.net/gh/Sliverkiss/QuantumultX@main/Utils/CryptoJS.min.js'
        ).then((fn) => {
            $.setdata(fn, 'CryptoJS_code')
            eval(fn)
            const CryptoJS = createCryptoJS();
            $.log(`✅ CryptoJS加载成功, 请继续`)
            resolve(CryptoJS)
        })
    })
}

//检查变量
async function checkEnv() {
    if (!userCookie) {
        $.log("未找到Cookie");
        return false;
    }

    return true;
}

//主程序执行入口
!(async () => {
    try {
        await loadModule();
        if (typeof $request != "undefined") {
            await getCookie();

            return;
        }

        //未检测到ck，退出
        if (!(await checkEnv())) { throw new Error(`❌未检测到ck，请添加环境变量`) };
        await main();
    } catch (e) {
        throw e;
    }
})()
    .catch((e) => { $.logErr(e), $.msg($.name, `⛔️ script run error!`, e.message || e) })
    .finally(async () => {
        $.done({ ok: 1 });
    });


class Tools {
    //13位时间戳
    static ts13() { return Math.round(new Date().getTime()).toString(); }

    // 10位时间戳
    static ts10() { return Math.floor(Math.round(new Date().getTime()) / 1000).toString(); }


    // 积分相关签名
    static signature(sessionId, nonce, timestamp, secretKey = null) {
        if (secretKey) {
            return Tools.calculateHMACSHA256(sessionId + nonce + timestamp, secretKey);
        }

        return Tools.calculateHMACSHA256(sessionId + nonce + timestamp)
    }

    // 用户
    static lanHeSHA256(arg) {
        const ts = arg["ts"];
        let params = { ...arg };
        delete params["ts"];

        let sortedKeys = Object.keys(params).sort();
        let concatenatedString = '62f3042e18c44b878cb0e714f57cd543'; // 用户的key

        sortedKeys.forEach(key => {
            let value = params[key];
            if (typeof value === "string") {
                value = value.replace(/\s+/g, ''); // 去除字符串中的所有空格
            }
            if (typeof value === "object") {
                value = JSON.stringify(value); // 转换对象或数组为JSON字符串
            }
            concatenatedString += `${value}`; // 拼接值到字符串中
        });

        concatenatedString += `${ts}`; // 添加时间戳到字符串末尾

        // 进行SHA-256哈希计算并转换为Base64编码
        const hash = Tools.calculateSHA256(concatenatedString);
        const base64 = Tools.encodeBase64(hash);

        return base64;
    }

    static calculateHMACSHA256(text, secretKey = "3eb937d7a15b08e5b9382c319f64d344") {
        return $.CryptoJS.HmacSHA256(text, secretKey).toString($.CryptoJS.enc.Hex);
    }

    static calculateSHA256(text) {
        return $.CryptoJS.SHA256(text).toString($.CryptoJS.enc.Hex);
    }

    static encodeBase64(text) {
        const wordArray = $.CryptoJS.enc.Utf8.parse(text); // 将字符串转换为WordArray
        return $.CryptoJS.enc.Base64.stringify(wordArray);
    }

    static decodeBase64(base64) {
        const wordArray = $.CryptoJS.enc.Base64.parse(base64); // 将Base64字符串转换为WordArray
        return $.CryptoJS.enc.Utf8.stringify(wordArray); // 将WordArray转换回原始字符串
    }

    static randomStringWithLength(len) {
        const letters = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
        let randomString = '';
        for (let i = 0; i < len; i++) {
            randomString += letters.charAt(Math.floor(Math.random() * letters.length));
        }
        return randomString;
    }

    // 保存签到时间
    static setLastSignInTime() {
        const now = new Date().toISOString();
        $.setdata(now, SIGN_IN_KEY);
    }

    // 今天是否签到过
    static hasSignedInToday() {
        const lastSignInTime = $.getdata(SIGN_IN_KEY);
        if (!lastSignInTime) return false;

        const lastSignIn = new Date(lastSignInTime);
        const now = new Date();

        return lastSignIn.toDateString() === now.toDateString();
    }
}


//请求函数函数二次封装
async function httpRequest(options) { try { options = options.url ? options : { url: options }; const _method = options?._method || ('body' in options ? 'post' : 'get'); const _respType = options?._respType || 'body'; const _timeout = options?._timeout || 15e3; const _http = [new Promise((_, reject) => setTimeout(() => reject(`??请求超时:${options['url']}`), _timeout)), new Promise((resolve, reject) => { debug(options, '[Request]'); $[_method.toLowerCase()](options, (error, response, data) => { debug(data, '[响应body]'); error && $.log($.toStr(error)); if (_respType !== 'all') { resolve($.toObj(response?.[_respType], response?.[_respType])); } else { resolve(response); } }) })]; return await Promise.race(_http); } catch (err) { $.logErr(err); } }

//DEBUG
function debug(content, title = "debug") { let start = `┌---------------↓↓${title}↓↓---------------\n`; let end = `\n└---------------↑↑${$.time('HH:mm:ss')}↑↑---------------`; if ($.is_debug === 'true') { if (typeof content == "string") { $.log(start + content.replace(/\s+/g, '') + end); } else if (typeof content == "object") { $.log(start + $.toStr(content) + end); } } };


//From chavyleung's Env.js
function Env(t, e) { class s { constructor(t) { this.env = t } send(t, e = "GET") { t = "string" == typeof t ? { url: t } : t; let s = this.get; return "POST" === e && (s = this.post), new Promise((e, a) => { s.call(this, t, (t, s, r) => { t ? a(t) : e(s) }) }) } get(t) { return this.send.call(this.env, t) } post(t) { return this.send.call(this.env, t, "POST") } } return new class { constructor(t, e) { this.name = t, this.http = new s(this), this.data = null, this.dataFile = "box.dat", this.logs = [], this.isMute = !1, this.isNeedRewrite = !1, this.logSeparator = "\n", this.encoding = "utf-8", this.startTime = (new Date).getTime(), Object.assign(this, e), this.log("", `🔔${this.name}, 开始!`) } getEnv() { return "undefined" != typeof $environment && $environment["surge-APP_VERSION"] ? "Surge" : "undefined" != typeof $environment && $environment["stash-APP_VERSION"] ? "Stash" : "undefined" != typeof module && module.exports ? "Node.js" : "undefined" != typeof $task ? "Quantumult X" : "undefined" != typeof $loon ? "Loon" : "undefined" != typeof $rocket ? "Shadowrocket" : void 0 } isNode() { return "Node.js" === this.getEnv() } isQuanX() { return "Quantumult X" === this.getEnv() } isSurge() { return "Surge" === this.getEnv() } isLoon() { return "Loon" === this.getEnv() } isShadowrocket() { return "Shadowrocket" === this.getEnv() } isStash() { return "Stash" === this.getEnv() } toObj(t, e = null) { try { return JSON.parse(t) } catch { return e } } toStr(t, e = null) { try { return JSON.stringify(t) } catch { return e } } getjson(t, e) { let s = e; const a = this.getdata(t); if (a) try { s = JSON.parse(this.getdata(t)) } catch { } return s } setjson(t, e) { try { return this.setdata(JSON.stringify(t), e) } catch { return !1 } } getScript(t) { return new Promise(e => { this.get({ url: t }, (t, s, a) => e(a)) }) } runScript(t, e) { return new Promise(s => { let a = this.getdata("@chavy_boxjs_userCfgs.httpapi"); a = a ? a.replace(/\n/g, "").trim() : a; let r = this.getdata("@chavy_boxjs_userCfgs.httpapi_timeout"); r = r ? 1 * r : 20, r = e && e.timeout ? e.timeout : r; const [i, o] = a.split("@"), n = { url: `http://${o}/v1/scripting/evaluate`, body: { script_text: t, mock_type: "cron", timeout: r }, headers: { "X-Key": i, Accept: "*/*" }, timeout: r }; this.post(n, (t, e, a) => s(a)) }).catch(t => this.logErr(t)) } loaddata() { if (!this.isNode()) return {}; { this.fs = this.fs ? this.fs : require("fs"), this.path = this.path ? this.path : require("path"); const t = this.path.resolve(this.dataFile), e = this.path.resolve(process.cwd(), this.dataFile), s = this.fs.existsSync(t), a = !s && this.fs.existsSync(e); if (!s && !a) return {}; { const a = s ? t : e; try { return JSON.parse(this.fs.readFileSync(a)) } catch (t) { return {} } } } } writedata() { if (this.isNode()) { this.fs = this.fs ? this.fs : require("fs"), this.path = this.path ? this.path : require("path"); const t = this.path.resolve(this.dataFile), e = this.path.resolve(process.cwd(), this.dataFile), s = this.fs.existsSync(t), a = !s && this.fs.existsSync(e), r = JSON.stringify(this.data); s ? this.fs.writeFileSync(t, r) : a ? this.fs.writeFileSync(e, r) : this.fs.writeFileSync(t, r) } } lodash_get(t, e, s) { const a = e.replace(/\[(\d+)\]/g, ".$1").split("."); let r = t; for (const t of a) if (r = Object(r)[t], void 0 === r) return s; return r } lodash_set(t, e, s) { return Object(t) !== t ? t : (Array.isArray(e) || (e = e.toString().match(/[^.[\]]+/g) || []), e.slice(0, -1).reduce((t, s, a) => Object(t[s]) === t[s] ? t[s] : t[s] = Math.abs(e[a + 1]) >> 0 == +e[a + 1] ? [] : {}, t)[e[e.length - 1]] = s, t) } getdata(t) { let e = this.getval(t); if (/^@/.test(t)) { const [, s, a] = /^@(.*?)\.(.*?)$/.exec(t), r = s ? this.getval(s) : ""; if (r) try { const t = JSON.parse(r); e = t ? this.lodash_get(t, a, "") : e } catch (t) { e = "" } } return e } setdata(t, e) { let s = !1; if (/^@/.test(e)) { const [, a, r] = /^@(.*?)\.(.*?)$/.exec(e), i = this.getval(a), o = a ? "null" === i ? null : i || "{}" : "{}"; try { const e = JSON.parse(o); this.lodash_set(e, r, t), s = this.setval(JSON.stringify(e), a) } catch (e) { const i = {}; this.lodash_set(i, r, t), s = this.setval(JSON.stringify(i), a) } } else s = this.setval(t, e); return s } getval(t) { switch (this.getEnv()) { case "Surge": case "Loon": case "Stash": case "Shadowrocket": return $persistentStore.read(t); case "Quantumult X": return $prefs.valueForKey(t); case "Node.js": return this.data = this.loaddata(), this.data[t]; default: return this.data && this.data[t] || null } } setval(t, e) { switch (this.getEnv()) { case "Surge": case "Loon": case "Stash": case "Shadowrocket": return $persistentStore.write(t, e); case "Quantumult X": return $prefs.setValueForKey(t, e); case "Node.js": return this.data = this.loaddata(), this.data[e] = t, this.writedata(), !0; default: return this.data && this.data[e] || null } } initGotEnv(t) { this.got = this.got ? this.got : require("got"), this.cktough = this.cktough ? this.cktough : require("tough-cookie"), this.ckjar = this.ckjar ? this.ckjar : new this.cktough.CookieJar, t && (t.headers = t.headers ? t.headers : {}, void 0 === t.headers.Cookie && void 0 === t.cookieJar && (t.cookieJar = this.ckjar)) } get(t, e = (() => { })) { switch (t.headers && (delete t.headers["Content-Type"], delete t.headers["Content-Length"], delete t.headers["content-type"], delete t.headers["content-length"]), t.params && (t.url += "?" + this.queryStr(t.params)), this.getEnv()) { case "Surge": case "Loon": case "Stash": case "Shadowrocket": default: this.isSurge() && this.isNeedRewrite && (t.headers = t.headers || {}, Object.assign(t.headers, { "X-Surge-Skip-Scripting": !1 })), $httpClient.get(t, (t, s, a) => { !t && s && (s.body = a, s.statusCode = s.status ? s.status : s.statusCode, s.status = s.statusCode), e(t, s, a) }); break; case "Quantumult X": this.isNeedRewrite && (t.opts = t.opts || {}, Object.assign(t.opts, { hints: !1 })), $task.fetch(t).then(t => { const { statusCode: s, statusCode: a, headers: r, body: i, bodyBytes: o } = t; e(null, { status: s, statusCode: a, headers: r, body: i, bodyBytes: o }, i, o) }, t => e(t && t.error || "UndefinedError")); break; case "Node.js": let s = require("iconv-lite"); this.initGotEnv(t), this.got(t).on("redirect", (t, e) => { try { if (t.headers["set-cookie"]) { const s = t.headers["set-cookie"].map(this.cktough.Cookie.parse).toString(); s && this.ckjar.setCookieSync(s, null), e.cookieJar = this.ckjar } } catch (t) { this.logErr(t) } }).then(t => { const { statusCode: a, statusCode: r, headers: i, rawBody: o } = t, n = s.decode(o, this.encoding); e(null, { status: a, statusCode: r, headers: i, rawBody: o, body: n }, n) }, t => { const { message: a, response: r } = t; e(a, r, r && s.decode(r.rawBody, this.encoding)) }) } } post(t, e = (() => { })) { const s = t.method ? t.method.toLocaleLowerCase() : "post"; switch (t.body && t.headers && !t.headers["Content-Type"] && !t.headers["content-type"] && (t.headers["content-type"] = "application/x-www-form-urlencoded"), t.headers && (delete t.headers["Content-Length"], delete t.headers["content-length"]), this.getEnv()) { case "Surge": case "Loon": case "Stash": case "Shadowrocket": default: this.isSurge() && this.isNeedRewrite && (t.headers = t.headers || {}, Object.assign(t.headers, { "X-Surge-Skip-Scripting": !1 })), $httpClient[s](t, (t, s, a) => { !t && s && (s.body = a, s.statusCode = s.status ? s.status : s.statusCode, s.status = s.statusCode), e(t, s, a) }); break; case "Quantumult X": t.method = s, this.isNeedRewrite && (t.opts = t.opts || {}, Object.assign(t.opts, { hints: !1 })), $task.fetch(t).then(t => { const { statusCode: s, statusCode: a, headers: r, body: i, bodyBytes: o } = t; e(null, { status: s, statusCode: a, headers: r, body: i, bodyBytes: o }, i, o) }, t => e(t && t.error || "UndefinedError")); break; case "Node.js": let a = require("iconv-lite"); this.initGotEnv(t); const { url: r, ...i } = t; this.got[s](r, i).then(t => { const { statusCode: s, statusCode: r, headers: i, rawBody: o } = t, n = a.decode(o, this.encoding); e(null, { status: s, statusCode: r, headers: i, rawBody: o, body: n }, n) }, t => { const { message: s, response: r } = t; e(s, r, r && a.decode(r.rawBody, this.encoding)) }) } } time(t, e = null) { const s = e ? new Date(e) : new Date; let a = { "M+": s.getMonth() + 1, "d+": s.getDate(), "H+": s.getHours(), "m+": s.getMinutes(), "s+": s.getSeconds(), "q+": Math.floor((s.getMonth() + 3) / 3), S: s.getMilliseconds() }; /(y+)/.test(t) && (t = t.replace(RegExp.$1, (s.getFullYear() + "").substr(4 - RegExp.$1.length))); for (let e in a) new RegExp("(" + e + ")").test(t) && (t = t.replace(RegExp.$1, 1 == RegExp.$1.length ? a[e] : ("00" + a[e]).substr(("" + a[e]).length))); return t } queryStr(t) { let e = ""; for (const s in t) { let a = t[s]; null != a && "" !== a && ("object" == typeof a && (a = JSON.stringify(a)), e += `${s}=${a}&`) } return e = e.substring(0, e.length - 1), e } msg(e = t, s = "", a = "", r) { const i = t => { switch (typeof t) { case void 0: return t; case "string": switch (this.getEnv()) { case "Surge": case "Stash": default: return { url: t }; case "Loon": case "Shadowrocket": return t; case "Quantumult X": return { "open-url": t }; case "Node.js": return }case "object": switch (this.getEnv()) { case "Surge": case "Stash": case "Shadowrocket": default: { let e = t.url || t.openUrl || t["open-url"]; return { url: e } } case "Loon": { let e = t.openUrl || t.url || t["open-url"], s = t.mediaUrl || t["media-url"]; return { openUrl: e, mediaUrl: s } } case "Quantumult X": { let e = t["open-url"] || t.url || t.openUrl, s = t["media-url"] || t.mediaUrl, a = t["update-pasteboard"] || t.updatePasteboard; return { "open-url": e, "media-url": s, "update-pasteboard": a } } case "Node.js": return }default: return } }; if (!this.isMute) switch (this.getEnv()) { case "Surge": case "Loon": case "Stash": case "Shadowrocket": default: $notification.post(e, s, a, i(r)); break; case "Quantumult X": $notify(e, s, a, i(r)); break; case "Node.js": }if (!this.isMuteLog) { let t = ["", "==============📣系统通知📣=============="]; t.push(e), s && t.push(s), a && t.push(a), console.log(t.join("\n")), this.logs = this.logs.concat(t) } } log(...t) { t.length > 0 && (this.logs = [...this.logs, ...t]), console.log(t.join(this.logSeparator)) } logErr(t, e) { switch (this.getEnv()) { case "Surge": case "Loon": case "Stash": case "Shadowrocket": case "Quantumult X": default: this.log("", `❗️${this.name}, 错误!`, t); break; case "Node.js": this.log("", `❗️${this.name}, 错误!`, t.stack) } } wait(t) { return new Promise(e => setTimeout(e, t)) } done(t = {}) { const e = (new Date).getTime(), s = (e - this.startTime) / 1e3; switch (this.log("", `🔔${this.name}, 结束! 🕛 ${s} 秒`), this.log(), this.getEnv()) { case "Surge": case "Loon": case "Stash": case "Shadowrocket": case "Quantumult X": default: $done(t); break; case "Node.js": process.exit(1) } } }(t, e) }