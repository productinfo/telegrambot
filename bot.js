const Telegraf = require('telegraf');
const axios = require('axios');
const {flag, code, name} = require('country-emoji');
require('datejs');

const BOT_TOKEN = process.env.TELEGRAM_TOKEN;

const session = require('telegraf/session');
const Stage = require('telegraf/stage');
const Markup = require('telegraf/markup');
const WizardScene = require('telegraf/scenes/wizard');

// TODO: need to be dynamic from api
const cats =
    {
        ai: '🧠',
        backend: '📦',
        blockchain: '⛓',
        devops: '🔨',
        frontend: '🖥',
        marketing: '🎰',
        mobile: '📱',
        pm: '🚧️',
        security: '👮‍♂️',
        testing: '🐛️',
        ui: '🎨',
        ux: '🧤'
    }


const conferenceBot = new WizardScene('conference',
    (ctx) => {

        // get categories
        axios.get('https://core.aweconf.com/api/categories')
            .then((resp) => {
                if (resp.data.success === true) {
                    const options = [];
                    resp.data.categories.map((entry) => {
                        options.push(Markup.callbackButton(cats[entry] + ' ' + entry, 'category:' + entry));
                    });
                    options.push(Markup.callbackButton('❌ Not specify', 'category:no'));

                    ctx.reply('🏷 Are you interested in a specific category?', Markup.inlineKeyboard(options, {columns: 2}).extra());
                    return ctx.wizard.next();
                }
            })
            .catch((err) => {
                console.log(err)
            });

    },
    (ctx) => {
        ctx.session.category = ctx.callbackQuery.data.split(':')[1];

        // get countries
        axios.get('https://core.aweconf.com/api/countries')
            .then((resp) => {
                if (resp.data.success === true) {
                    const options = [];
                    /*resp.data.countries.map((entry) => {
                        options.push(Markup.callbackButton(flag(entry) +' '+ entry, 'country:' + entry));
                    });*/
                    options.push(Markup.callbackButton('❌ Not Specify', 'country:no'));
                    //ctx.reply('🌎 Where? (Country, City)', Markup.inlineKeyboard(options, {columns: 2}).extra())
                    ctx.reply('🌎 Where? (Country)', Markup.inlineKeyboard(options, {columns: 2}).extra())
                    return ctx.wizard.next();
                }
            })
            .catch((err) => {
                console.log(err)
            });
    },
    (ctx) => {

        if (ctx.callbackQuery) {
            ctx.session.country = 'no';
        } else {
            ctx.session.country = ctx.update.message.text;
        }

        ctx.reply('🗓 Last info: is there any specific period you are interested in?', Markup.inlineKeyboard([
            Markup.callbackButton('This month', 'period:thismonth'),
            Markup.callbackButton('Next month', 'period:nextmonth'),
            Markup.callbackButton('Within 3 months', 'period:next3month'),
            Markup.callbackButton('This year', 'period:thisyear'),
            Markup.callbackButton('❌ Not specify', 'period:no')
        ], {columns: 2}).extra())

        return ctx.wizard.next()
    },
    (ctx) => {
        ctx.session.period = ctx.callbackQuery.data.split(':')[1];
        //console.log(ctx.session);

        var category = '';
        if (ctx.session.category !== 'no') {
            category = ' about ' + cats[ctx.session.category] + ' ' + ctx.session.category
        }

        var where = '';
        if (ctx.session.country !== 'no') {
            where = ' in ' + ctx.session.country
        }

        var period = ''
        var startDate = new Date()
        var endDate = new Date()
        if (ctx.session.period !== 'no') {
            period = ' during ' + ctx.session.period

            if (ctx.session.period === 'thismonth') {
                startDate = Date.today().clearTime().moveToFirstDayOfMonth();
                endDate = Date.today().clearTime().moveToLastDayOfMonth();
            } else if (ctx.session.period === 'nextmonth') {
                startDate = Date.parse('next month').clearTime().moveToFirstDayOfMonth();
                endDate = Date.parse('next month').clearTime().moveToLastDayOfMonth();
            } else if (ctx.session.period === 'next3month') {
                startDate = Date.today().clearTime().moveToFirstDayOfMonth();
                endDate = Date.parse('next 3 month').clearTime().moveToLastDayOfMonth();
            } else if (ctx.session.period === 'thisyear') {
                startDate = Date.today().clearTime().moveToFirstDayOfMonth();
                endDate = Date.parse('next december').clearTime().moveToLastDayOfMonth();
            }


        }

        const query = {
            category: (ctx.session.category === "no") ? 'none' : ctx.session.category,
            from: (ctx.session.period === "no") ? 'none' : startDate,
            to: (ctx.session.period === "no") ? 'none' : endDate,
            where: (ctx.session.country === "no") ? 'none' : ctx.session.country,
            limit: 3
        };

        //console.log(query);

        // get conference
        axios.post('https://core.aweconf.com/api/conference/search', query)
            .then((resp) => {
                //console.log(resp.data)
                if (resp.data.success === true) {

                    if (resp.data.conferences.length == 0) {
                        ctx.reply('😰 I have found no conferences ' + category + where + period + ' 😰')
                        return ctx.scene.leave()
                    } else {
                        const options = [];
                        resp.data.conferences.map((entry) => {
                            options.push(Markup.urlButton(entry.title, 'https://aweconf.com/#/c/' + entry.slug));
                        });

                        ctx.reply('🎟 Here 3 of the best upcoming conference' + category + where + period + ' I found:', Markup.inlineKeyboard(options, {columns: 1}).extra());
                        return ctx.scene.leave()
                    }


                }
            })
            .catch((err) => {
                console.log(err)
            });

    }
);

const bot = new Telegraf(BOT_TOKEN);
bot.use(session({ttl: 30}));

const stage = new Stage([conferenceBot], {default: 'conference'});
bot.use(stage.middleware());

bot.command('start', (ctx) => {
    ctx.scene.abort()
    ctx.scene.start()
});

bot.start((ctx) => {
    ctx.session.category = '';
    ctx.session.period = '';
    ctx.session.country = '';
    console.log('started:', ctx.from.id);
    return ctx.reply('🎟 Hi ' + ctx.from.first_name + '!')
}).startPolling();