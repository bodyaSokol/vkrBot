const BOT_TOKEN = process.env.BOT_TOKEN || "5745883031:AAFu7D_YO08TIJlhLkWGwfBEHB_lCNji0b0";
const PROVIDER_TOKEN = process.env.PROVIDER_TOKEN||"381764678:TEST:56879";
const Telegraf = require('telegraf');
const session = require('telegraf/session');// пакет сессий, неоюходим для сцен
const Stage = require('telegraf/stage');// менеджер сцен
const WizardScene = require('telegraf/scenes/wizard');// менеджер пошаговых сцен
const axios = require("axios");// для АПИ запросов
const bot_username = "sokol_telegraf_test_bot";
const valute = "рублей";
const root_api_address = "http://88.151.117.211:3500";

const bmiValue = require('./bmiValue');
const bot = new Telegraf(BOT_TOKEN);

function isNumber(value){
   return typeof value === 'number' && isFinite(value);
}

const getInvoice = (id,title_param='Оплата заказа',description_param="Описание заказа",prices_param=[{ label: 'Invoice Title', amount: 100 * 100 }]) => {
    const invoice = {
      chat_id: id, // Уникальный идентификатор целевого чата или имя пользователя целевого канала
      title: title_param, // Название продукта, 1-32 символа
      description: description_param, // Описание продукта, 1-255 знаков
      payload: { // Полезные данные счета-фактуры, определенные ботом, 1–128 байт. Это не будет отображаться пользователю, используйте его для своих внутренних процессов.
        unique_id: `${id}_${Number(new Date())}`,
        provider_token: PROVIDER_TOKEN 
      },
      provider_token: PROVIDER_TOKEN, // токен выданный через бот @SberbankPaymentBot       
      currency: 'RUB', // Трехбуквенный код валюты ISO 4217
      start_parameter: 'get_access', //Уникальный параметр глубинных ссылок. Если оставить поле пустым, переадресованные копии отправленного сообщения будут иметь кнопку «Оплатить», позволяющую нескольким пользователям производить оплату непосредственно из пересылаемого сообщения, используя один и тот же счет. Если не пусто, перенаправленные копии отправленного сообщения будут иметь кнопку URL с глубокой ссылкой на бота (вместо кнопки оплаты) со значением, используемым в качестве начального параметра.
      prices: prices_param, // Разбивка цен, сериализованный список компонентов в формате JSON 100 копеек * 100 = 100 рублей
      need_email:true,
      send_email_to_provider:true
    };
    return invoice
  }

const welcomeScene = new WizardScene('welcome',
    async(ctx)=>{
        const user_id = ctx.message.chat.id;
        try{
            const currencyObj = await axios.get(`${root_api_address}/api/users/${user_id}`);
            if(currencyObj.data.values.rows.length>0){
                ctx.scene.leave();
                ctx.scene.enter("menu");
            }else{
                ctx.wizard.next();
                return ctx.wizard.steps[ctx.wizard.cursor](ctx);
            }
        }catch(err){
            console.log(err);
            ctx.wizard.next();
            return ctx.wizard.steps[ctx.wizard.cursor](ctx);
        }
    },
    async(ctx)=>{
        axios.post(`${root_api_address}/api/users`, {
            telegram_id: ctx.message.chat.id,
            telegram_name:ctx.message.chat.first_name,
            telegram_lastname:ctx.message.chat.last_name,
            telegram_nickname:ctx.message.chat.username
        })
        .then(function (response) {

        })
        .catch(function (error) {
            console.log(error);
        });
        ctx.wizard.next();
        return ctx.wizard.steps[ctx.wizard.cursor](ctx);
    },
    (ctx)=>{
        ctx.reply('Мы приветствуем вас в нашем чат-боте для покупки и доставки продуктов!');
        setTimeout(function(){
            ctx.reply('У нас вы можете:\n\n🛒 выбрать нужные продукты\n🚚 указать адрес доставки\n💴 оплатить товар и получить бонус\n\nНажимай на кнопку "Купить товары 🛒" и скорее начинай покупки!');
            ctx.wizard.next();
            return ctx.wizard.steps[ctx.wizard.cursor](ctx);
        },1000)
    },
    (ctx)=>{
        setTimeout(function(){
            ctx.scene.leave();
            ctx.scene.enter("menu");
        },1000)
    }
);
const menuAndWebAppScene = new WizardScene('menu',
    (ctx)=>{
        ctx.reply(`Чтобы начать выбирать товары, нажимайте на кнопку снизу ⬇️⬇️⬇️`,{
            reply_markup: {
                resize_keyboard:true,
                one_time_keyboard:true,
                remove_keyboard: true,
                hide_keyboard: true,
                keyboard: [
                    [ { text: "Купить товары 🛒",web_app:{url:"https://botsband.online/botShop/"}}],
                    [ { text: "Мои бонусы 💵"},{ text: "Задать вопрос 💬"}]
                ]
            }
        });
        ctx.wizard.next();
    },
    (ctx)=>{
        if("web_app_data" in ctx.message){
            if(ctx.message.web_app_data.button_text=="Купить товары 🛒"){
                ctx.wizard.state.web_app_data = ctx.message.web_app_data.data;
                ctx.wizard.next();
            }
        }else if(ctx.message.text=="Мои бонусы 💵"){
            ctx.scene.leave();
            return ctx.scene.enter("bonuces");
        }else if(ctx.message.text=="Задать вопрос 💬"){
            ctx.scene.leave();
            return ctx.scene.enter("question");
        }
        else{
            ctx.reply('Необходимо выбрать вариант из кнопок');
            ctx.wizard.back();
        }
        return ctx.wizard.steps[ctx.wizard.cursor](ctx);
    },
    (ctx)=>{
        const user_id = ctx.message.chat.id;
        axios.post(`${root_api_address}/api/users/phone/check`, {
            telegram_id: user_id
        })
        .then(function (response) {
            if(response.data.values.phone_existence===true){
                let phone_from_row = response.data.values.rows[0].phone;
                ctx.wizard.state.phone = phone_from_row;
                ctx.wizard.next();
                return ctx.wizard.steps[ctx.wizard.cursor](ctx);
            }else{
                ctx.reply(`Чтобы сделать заказ, необходимо поделиться номером телефона. Для этого нажмите на кнопку снизу ⬇️`,{
                    reply_markup: {
                        one_time_keyboard:true,
                        remove_keyboard: true,
                        hide_keyboard: true,
                        keyboard: [
                            [ { text: "Передать номер телефона ✅",request_contact:true}]
                        ]
                    }
                });
            }
        })
        .catch(function (error) {
            console.log(error);
            ctx.reply(`Чтобы сделать заказ, необходимо поделиться номером телефона. Для этого нажмите на кнопку снизу ⬇️`,{
                reply_markup: {
                    keyboard: [
                        [ { text: "Передать номер телефона ✅",request_contact:true}]
                    ]
                }
            });
        });
        ctx.wizard.next();
    },
    (ctx)=>{
        if("contact" in ctx.message){
            const user_id = ctx.message.chat.id;
            ctx.wizard.state.phone = ctx.message.contact.phone_number;
            ctx.wizard.next();
            axios.post(`${root_api_address}/api/users/phone/set`, {
                telegram_id: user_id,
                phone:ctx.wizard.state.phone
            })
        }else if(ctx.wizard.state.phone){
            ctx.wizard.next();
        }else{
            ctx.reply('Необходимо выбрать вариант из кнопок');
            ctx.wizard.back();
        }
        return ctx.wizard.steps[ctx.wizard.cursor](ctx);
    },
    async(ctx)=>{
        try{
            const user_id = ctx.message.chat.id;
            const currencyObj = await axios.get(`${root_api_address}/api/users/${user_id}/orders`);
            let orders = currencyObj.data.values;
            let address_keyboard = [];
            orders.forEach(order => {
                let check = address_keyboard.find(find_address => find_address[0].text == order.delivery_address);
                if(!check) address_keyboard.push([{text:order.delivery_address}]);// исключать повторения
            })
            ctx.reply(`Укажите адрес для доставки ⬇️`,{
                reply_markup: {
                    remove_keyboard: true,
                    keyboard: address_keyboard
                }
            });
        }catch(err){
            console.log(err);
            ctx.reply(`Укажите адрес для доставки ⬇️`,{
                reply_markup: {
                    remove_keyboard: true
                }
            });
        }
        ctx.wizard.next();
    },
    (ctx)=>{
        if("text" in ctx.message){
            ctx.wizard.state.address = ctx.message.text;
            ctx.wizard.next();
        }else{
            ctx.reply('Укажите адрес текстом');
            ctx.wizard.back();
        }
        return ctx.wizard.steps[ctx.wizard.cursor](ctx);
    },
    async(ctx)=>{
        const user_id = ctx.message.chat.id;
        try{
            const currencyObj = await axios.get(`${root_api_address}/api/users/${user_id}`);
            let bonuces_amount = currencyObj.data.values.rows[0].bonuces_amount;
            if(bonuces_amount>0){
                ctx.wizard.state.bonuces_available = bonuces_amount;
                ctx.reply(`На вашем счету ${bonuces_amount} бонусных ${valute}. Впишите количество бонусов, которые необходимо списать ✍️`,{
                    reply_markup: {
                        keyboard: [
                            [ { text: "Списать все бонусы"}],
                            [ { text: "Не списывать"}]
                        ]
                    }
                });
                ctx.wizard.next();
            }else{
                ctx.wizard.state.bonuces_used = 0;
                ctx.wizard.next();
                return ctx.wizard.steps[ctx.wizard.cursor](ctx);
            }
        }catch(err){
            ctx.wizard.state.bonuces_used = 0;
            ctx.wizard.next();
            return ctx.wizard.steps[ctx.wizard.cursor](ctx);
        }
    },
    (ctx)=>{
        if(ctx.wizard.state.bonuces_used == 0){
            ctx.wizard.next();
        }else if(ctx.message.text=="Списать все бонусы"){
            ctx.wizard.state.bonuces_used = ctx.wizard.state.bonuces_available;
            ctx.wizard.next();
        }else if(ctx.message.text=="Не списывать"){
            ctx.wizard.state.bonuces_used = 0;
            ctx.wizard.next();
        }else if(isNumber(Number(ctx.message.text))&&Number(ctx.message.text)>=0){
            if(ctx.message.text<=ctx.wizard.state.bonuces_available){
                ctx.wizard.state.bonuces_used = ctx.message.text;
                ctx.wizard.next();
            }else{
                ctx.reply(`Можно списать не более ${ctx.wizard.state.bonuces_available} бонусов.`,{reply_markup: {remove_keyboard: true}});
                ctx.wizard.back();
            }
        }else{
            ctx.reply(`Необходимо вписать число больше нуля`,{reply_markup: {remove_keyboard: true}});
            ctx.wizard.back();
        }
        return ctx.wizard.steps[ctx.wizard.cursor](ctx);
    },
    (ctx)=>{
        const bucket_from_webApp = JSON.parse(ctx.wizard.state.web_app_data);
        let prices_list_text = "";
        let result_sum_without_discount = 0;
        let result_sum = 0;
        let result_discount = 0;
        bucket_from_webApp.forEach(element => {
            result_sum_without_discount = result_sum_without_discount + (element.price * element.productCount);
            result_sum = result_sum + ((element.price - element.discount) * element.productCount);
            result_discount = result_discount + (element.discount * element.productCount);
            prices_list_text = `${prices_list_text}\n<u>${element.name}</u> \n${(element.discount>0)?(element.price - element.discount):element.price} x ${element.productCount} = ${(element.price - element.discount)*element.productCount} ${valute} ${(element.discount>0)?"(Скидка "+(element.discount*element.productCount)+" "+valute+")":""}\n`;
        });
        prices_list_text = prices_list_text + ((result_discount>0)?`\n<b>Итого:</b> ${result_sum_without_discount} ${valute}\n<b>Скидка:</b> ${result_discount} ${valute}`:``);
        if(ctx.wizard.state.bonuces_used>0){
            if(ctx.wizard.state.bonuces_used>result_sum){
                ctx.wizard.state.bonuces_used=result_sum;
            }
            prices_list_text = prices_list_text + `\n<b>Применено бонусов:</b> ${ctx.wizard.state.bonuces_used}`;
            result_sum = result_sum - ctx.wizard.state.bonuces_used;
        }
        prices_list_text = prices_list_text + `\n<b>К оплате:</b> ${result_sum} ${valute}`;
        prices_list_text = `${prices_list_text}\n\n<b>Номер телефона:</b> ${ctx.wizard.state.phone}\n<b>Адрес доставки:</b> ${ctx.wizard.state.address}`;
        ctx.wizard.state.prices_list_text = prices_list_text;
        ctx.replyWithHTML("<b>Ваш заказ:</b>\n"+prices_list_text,{
            reply_markup: {
                one_time_keyboard:true,
                keyboard: [
                    [ { text: "Перейти к оплате ✅"}]
                ]
            }
        });
        ctx.wizard.next();
    },
    (ctx)=>{
        if(ctx.message.text=="Перейти к оплате ✅"){
            ctx.wizard.next();
        }
        else{
            ctx.reply('Необходимо выбрать вариант из кнопок');
            ctx.wizard.back();
        }
        return ctx.wizard.steps[ctx.wizard.cursor](ctx);
    },
    (ctx)=>{
        ctx.replyWithHTML('<b>Данные тестовой карты</b>\n\nКарта: <code>1111111111111026</code>\n\nСрок действия: <code>12/22</code>\n\nCVC: <code>000</code>',{
            reply_markup: {
                remove_keyboard: true
            }
        });
        let prices_list = [];
        let bucket_from_webApp = JSON.parse(ctx.wizard.state.web_app_data);
        bucket_from_webApp.forEach(element => {
            const result_price = (element.discount>0)?element.price - element.discount:element.price;
            prices_list.push({label:element.name,amount:result_price * element.productCount * 100})
        });
        if(ctx.wizard.state.bonuces_used>0){
            prices_list.push({label:"Списано бонусов",amount: ctx.wizard.state.bonuces_used * -100})
        }
        setTimeout(function(){
            ctx.replyWithInvoice(getInvoice(ctx.from.id,"Оплата заказа","Покупка и доставка продуктов",prices_list),{
                reply_markup: {
                    inline_keyboard: [
                        [ { text: "Оплатить ",pay:true}],
                        [ { text: "Отменить оплату",callback_data:"back"}]
                    ]
                }
            });
            ctx.wizard.next();
        },1000)
    },
    (ctx)=>{
        if("callback_query" in ctx.update){
            if(ctx.update.callback_query.data === "back"){
                ctx.wizard.selectStep(0);
            }
        }else if("successful_payment" in ctx.message){
            ctx.wizard.next();
        }else{
            ctx.reply('Необходимо оплатить товары');
            ctx.wizard.back();
        }
        return ctx.wizard.steps[ctx.wizard.cursor](ctx);
    },
    (ctx)=>{
        axios.post(`${root_api_address}/api/orders`, {
            telegram_id: ctx.message.chat.id,
            bonuces_used:ctx.wizard.state.bonuces_used,
            delivery_address:ctx.wizard.state.address,
            products:JSON.parse(ctx.wizard.state.web_app_data)
        })
        .then(function (response) {
            let order_id = response.data.values.id;
            let order_bonuses_accrued = response.data.values.bonuses_accrued;
            ctx.reply(`Ваш заказ №${order_id} оплачен успешно! Вам начислено ${order_bonuses_accrued} бонусов.`,{reply_markup: {remove_keyboard: true}});
            /////////////////////////////////////////////////////
            axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
            text: `⬇️ <b>Новый заказ</b> ⬇️\n\n${ctx.wizard.state.prices_list_text}\n${(ctx.message.chat.username)?"@"+ctx.message.chat.username:""}`,
            chat_id: -1001886258703,
            parse_mode:"HTML",
            reply_markup:{
                inline_keyboard: [
                  [
                    {
                      "text": "Заказ собран",
                      "callback_data": `${user_id},${order_id},Собран`
                    }
                  ],
                  [
                    {
                        "text": "Заказ передан курьеру",
                        "callback_data": `${user_id},${order_id},Передан курьеру`
                    }
                  ],
                  [
                    {
                        "text": "Заказ доставлен",
                        "callback_data": `${user_id},${order_id},Доставлен`
                    }
                  ]
                ]
            }
        })
        .then(function (response) {

        })
        .catch(function (error) {
            console.log(error);
        });
        })
        .catch(function (error) {
            ctx.reply(`Error`,{reply_markup: {remove_keyboard: true}});
            console.log(error);
        });
        setTimeout(function(){
            ctx.scene.leave();
            ctx.scene.enter("menu");
        }, 1500);
    }
)
const bonucesScene = new WizardScene('bonuces',
    async(ctx)=>{
        const user_id = ctx.message.chat.id;
        try{
            const currencyObj = await axios.get(`${root_api_address}/api/users/${user_id}`);
            let bonuces_amount = currencyObj.data.values.rows[0].bonuces_amount;
            ctx.reply(`На вашем счету ${bonuces_amount} бонусных ${valute}`);
            ctx.wizard.next();
            return ctx.wizard.steps[ctx.wizard.cursor](ctx);
        }catch(err){
            console.log(err);
            ctx.wizard.next();
            return ctx.wizard.steps[ctx.wizard.cursor](ctx);
        }
    },
    (ctx)=>{
        setTimeout(function(){
            ctx.scene.leave();
            ctx.scene.enter("menu");
        },1000)
        
    }
);

const questionScene = new WizardScene('question',
    (ctx)=>{
        ctx.reply(`Напишите свой вопрос ⬇️`,);
        ctx.wizard.next();
    },
    (ctx)=>{
        if("text" in ctx.message){
            ctx.wizard.state.question = ctx.message.text;
            ctx.wizard.next();
        }else{
            ctx.reply('Укажите адрес текстом');
            ctx.wizard.back();
        }
        return ctx.wizard.steps[ctx.wizard.cursor](ctx);
    },
    (ctx)=>{
        const user_id = ctx.message.chat.id;
        axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
            text: ctx.wizard.state.question,
            chat_id: -1001886258703,
            reply_markup:{
                inline_keyboard: [
                  [
                    {
                      "text": "Дайте ответ на вопрос",
                      "url": `http://t.me/${bot_username}?user_id=${user_id}`
                    }
                  ]
                ]
            }
        })
        .then(function (response) {
            ctx.reply(`Сообщение отправлено успешно!`);
            ctx.wizard.next();
            return ctx.wizard.steps[ctx.wizard.cursor](ctx);
        })
        .catch(function (error) {
            console.log(error);
            ctx.wizard.next();
            return ctx.wizard.steps[ctx.wizard.cursor](ctx);
        });
    },
    (ctx)=>{
        ctx.scene.leave();
        ctx.scene.enter("menu");
    }
);

const stage = new Stage();
stage.register(welcomeScene);
stage.register(menuAndWebAppScene);
stage.register(bonucesScene);
stage.register(questionScene);
bot.use(session());
bot.use(stage.middleware());


bot.start((ctx)=>{
    ctx.scene.enter("welcome");
})

bot.on("message",async(ctx)=>{
    const chat_id = ctx.message.chat.id; 
    if(chat_id==-1001886258703 && "reply_to_message" in ctx.message){
        if("reply_markup" in ctx.message.reply_to_message){
            let url_in_button = ctx.message.reply_to_message.reply_markup.inline_keyboard[0][0].url;
            let user_id_index=Number(url_in_button.indexOf('?user_id='))+9;
            let chat_to_send=url_in_button.slice(user_id_index);
            let answer = `Ответ администратора: "${ctx.message.text}"\n\nЧтобы продолжить нажмите на /start`;
            axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
                text: answer,
                chat_id: chat_to_send
            })
        }
    }
})

bot.on('pre_checkout_query', (ctx) => ctx.answerPreCheckoutQuery(true)) // ответ на предварительный запрос по оплате

bot.launch().then(res=>{
    var now = new Date();
    console.log(`Started ${now.toUTCString()}`);
}).catch(err=>console.log(err));