const express = require("express");
const Route = express.Router();

const {UsersModel, valUserCallBack} = require("../model/users.model");
const UserEventsModel = require("../model/user_events.model");

const { setLogin, logout, valAuth, formatUrl, rdr, valLoginActive, jsonRes, errHandler, validateData } = require("../helper/utilities");

const path = require("path");
const crypto = require("crypto");
const multer = require("multer");

const CronJob = require("cron").CronJob;

const nodeMailer = require("nodemailer");



// ===> Cron Dealings <===

/**
 * cron to check if uncompleted schedule exists before starting base cron
 */
const CheckIfUncompletedScheduleExists = new CronJob(
    `*/${process.env.CRON_INTERVAL} * * * *`, 
    async function() {
        let hasUncompletedSchedule = await UserEventsModel.getUserEvents(null, 1, {status: true, event_completed: false});
        if (hasUncompletedSchedule.length > 0) {
            processUmcompletedSchedules();
        }
        console.log('Ran cron');
    }, 
    null, 
    false, 
    'Africa/Lagos',
);
CheckIfUncompletedScheduleExists.start();

async function processUmcompletedSchedules() {
    console.log('Processing cron job');
    // get uncompleted schedules
    let uncompletedSchedule = await UserEventsModel.getUserEvents(null, null, {status: true, event_completed: false});
    // loop
    [...uncompletedSchedule].forEach(async (eachSchedule) => {
        let isDueForNotification = (new Date(eachSchedule.event_date).getTime() - new Date().getTime()) <= (5 * 60 * 60 * 1000);
        if (isDueForNotification) {
            let { id, event_name, event_date, event_location, event_desc, user, user_notified } = eachSchedule;
            let { first_name, email } = await UsersModel.validUser({id: user});
            if (user_notified == 1 && (new Date(eachSchedule.event_date).getTime() - new Date().getTime()) <= 0) {
                UserEventsModel.update(
                    {
                        event_completed: true,
                    },
                    {
                        where: {id: id}
                    }
                );
            } else {
                let message = {
                    from: "<noreply.notifier@eventscheduler.com>",
                    to: email,
                    replyTo: 'noreply.notifier@eventscheduler.com',
                    text: `Hello ${first_name},\nYour scheduled event is almost due.\n\nEvent name: ${event_name}\nEvent Location: ${event_location}\nEvent date: ${event_date}\nEvent description: ${event_desc}\n\nThanks.`,
                };
                if (mailer(message)) {
                    UserEventsModel.update(
                        {
                            user_notified: true,
                            event_completed: (new Date(eachSchedule.event_date).getTime() - new Date().getTime()) <= 0 ? true : false
                        },
                        {
                            where: {id: id}
                        }
                    );
                }
            }
        }
    });
}

async function mailer(message) {
    try {
		// define transporter
		const transporter = nodeMailer.createTransport({
			pool: true,
			host: process.env.MAIL_HOST,
			port: process.env.MAIL_PORT,
			secure: false,
			auth: {
				user: process.env.MAIL_USERNAME,
				pass: process.env.MAIL_PASSWORD
			},
			tls: {
				// do not fail on invalid certs
				rejectUnauthorized: false
			}
		});
        // send mail
        await transporter.sendMail(message);
	} catch (error) {
		console.log(error);
	}
}



// ===> Route Dealings <===

// resource upload path
const resourceUploadPath = path.join(__dirname, '..', '/public/assets/uploads/events');

/**
 * upload handlers
 */
const storage = multer.diskStorage({
    destination(req, file, cb) {
        if (!file.originalname.match(/\.(jpeg|jpg|png)/)) {
            return cb(new Error('Only jpeg or jpg or png file type is valid.'));
        }
        cb(null, `${resourceUploadPath}`);
    },
    filename(req, file, cb) {
        cb(null,`${crypto.createHash('md5').update(`${Date.now()}`).digest('hex')}.${file.mimetype.split('/')[1]}`);
    },
});
const upload = multer({storage});

/**
 * landing page route
 */
Route.get('/', (req, res) => {
    res.redirect('/login');
});

/**
 * Login route
 */
Route.use('/login', valLoginActive, async (req, res) => {
    const urlParams = formatUrl(req.originalUrl);
    if (req.method === 'POST') {
        let notification = {msg: 'Login failed, please try again.', type: 'error'};
        try {
            const {dst = '/schedule'} = req.query;
            const {email = null, password = null} = req.body;
            const valData = await UsersModel.verifyLogin(email, password);
            if (valData) {
                if (valData.status === true) {
                    await setLogin(res, {user: valData.id});
                    return rdr(req, res, decodeURI(dst));
                }
                notification = {msg: 'Your account has been disabled for violation our terms. Contact our support team for more details.', type: 'error'}
            } else {
                notification = {msg: 'Incorrect login credentials.', type: 'error'}
            }
        } catch (error) {
            let errMsg = errHandler(error, 'Login failed, please try again.');
            notification = {msg: errMsg, type: 'error'}
        }
        return res.render(
            'login.ejs', 
            {
                notification,
                formData: req.body,
                urlParams
            }
        );
    }
    res.render('login.ejs', {urlParams});
});

/**
 * signup route
 */
Route.use('/signup', valLoginActive, async (req, res) => {
    const urlParams = formatUrl(req.originalUrl);
    if (req.method === 'POST') {
        let notification = {msg: 'Signup failed, please try again.', type: 'error'};
        try {
            const {dst = '/schedule'} = req.query;
            let {
                first_name = null, 
                last_name = null, 
                dob = null, 
                gender = null, 
                email = null, 
                password = null
            } = req.body;
            // trim
            first_name = first_name.trim();
            last_name = last_name.trim();
            dob = dob.trim();
            gender = gender.trim();
            email = email.trim();
            // add new user
            const addNewUser = await UsersModel.addUser({first_name, last_name, dob, gender, email, password});
            if (addNewUser) {
                await setLogin(res, {user: addNewUser.id});
                return rdr(req, res, decodeURI(dst));
            }
        } catch (error) {
            let errMsg = errHandler(error, 'Signup failed, please try again.');
            notification = {msg: errMsg, type: 'error'}
        }
        return res.render(
            'signup.ejs', 
            {
                notification,
                formData: req.body,
                urlParams
            }
        );
    }
    res.render('signup.ejs', {urlParams});
});

/**
 * home route
 */
Route.get('/home', valAuth, valUserCallBack, async (req, res) => {
    res.render('home.ejs', {path: '/home', userData: res.locals.user});
});

/**
 *  setting route
 */
Route.get('/setting', valAuth, valUserCallBack, async (req, res) => {
    res.render('setting.ejs', {path: '/setting', userData: res.locals.user});
});

/**
 * route to edit account
 */
Route.post('/s/account', valAuth, valUserCallBack, async (req, res) => {
    try {
        let { first_name = null, last_name = null, email = null, dob = null, gender = null } = req.body;
        if (!(first_name) || !(last_name) || !(email) || !(dob) || !(gender)) {
            throw new Error("All fields are required.");
        }
        const editAccount = await UsersModel.update(
            {
                first_name, 
                last_name, 
                dob, 
                gender, 
                email
            },
            {
                where: {id: res.locals.user.id}
            }
        );
        if (!editAccount) {
            throw new Error('Account update failed, try again.');
        }
        res.json(jsonRes({data: 'Your account data has been updated.'}))
    } catch (error) {
        let errMsg = errHandler(error,'Unable to process request, try again.');
        res.json(jsonRes({error: true, errorMsg: errMsg}));
    }
});

/**
 * route to change password
 */
Route.post('/s/password', valAuth, valUserCallBack, async (req, res) => {
    try {
        let { current_password = null, new_password = null } = req.body;
        if (!(current_password) || !(new_password)) {
            throw new Error('All fields are required.');
        }
        if (!(await UsersModel.verifyPassword(current_password, res.locals.user.password))) {
            throw new Error('Current password is incorrect.');
        }
        if (current_password === new_password) {
            throw new Error('New password must be different from current password.')
        }
        const changePassword = await UsersModel.update(
            {password: new_password},
            {where: {id: res.locals.user.id}}
        );
        if (!changePassword) {
            throw new Error('Password change failed, try again');
        }
        res.json(jsonRes({data: 'Your password has been changed.'}));
    } catch (error) {
        let errMsg = errHandler(error,'Unable to process request, try again.');
        res.json(jsonRes({error: true, errorMsg: errMsg}));
    }
});

/**
 *  schedule route
 */
Route.get('/schedule', valAuth, valUserCallBack, async (req, res) => {
    res.render('schedule.ejs', {path: '/schedule', userData: res.locals.user});
});

/**
 * route to fetch user schedules
 */
Route.get('/schedule/fetch', valAuth, valUserCallBack, async (req, res) => {
    try {
        let {s = null, l = 20, e = null} = req.query;
        if (s && !(validateData(s, /^([\d]+)$/))) {
            throw new Error('Invalid filter parameter, refresh and try again.')
        }
        if (!(validateData(l, /^([\d]+)$/))) {
            throw new Error('Invalid filter parameter, refresh and try again.')
        }
        // define user filter
        const isAdmin = res.locals.user.rank === 'admin';
        let filter = isAdmin && (e && JSON.parse(e) === 1) ? null : {status: true, user: res.locals.user.id};
        let schedule = await UserEventsModel.getUserEvents(s, (l + 1), filter);
        let more = null;
        if (schedule.length > l) {
            more = schedule[schedule.length - 2].id;
            schedule.pop();
        }
        res.json(jsonRes({data: {schedule, more}}));
    } catch (error) {
        let errMsg = errHandler(error,'Schedules cannot be retrieved at this time, try again later.');
        res.json(jsonRes({error: true, errorMsg: errMsg}));
    }
});

/**
 * route to filter schedule
 */
Route.get('/schedule/filter', valAuth, valUserCallBack, async (req, res) => {
    try {
        let { q = null, l = 20, e = null } = req.query;
        if (!q) {
            throw new Error('No filter value passed in request.');
        }
        // define user filter
        const isAdmin = res.locals.user.rank === 'admin';
        let filter = isAdmin && (e && JSON.parse(e) === 1) ? null : {status: true, user: res.locals.user.id};
        // search
        const schedule = await UserEventsModel.searchUserEvents(q, l, filter);
        res.json(jsonRes({data: {schedule, more: null}}));
    } catch (error) {
        let errMsg = errHandler(error,'Unable to process request, try again.');
        res.json(jsonRes({error: true, errorMsg: errMsg}));
    }
});

/**
 * route to schedule new event
 */
Route.post('/schedule/new', valAuth, valUserCallBack, async (req, res) => {
    try {
        let { event_name = null, event_color = null, event_date = null, event_desc = null, event_location = null } = req.body;
        if (!event_name || !event_date || !event_color) {
            throw new Error(`Fill all required fileds.`);
        }
        if ((new Date(event_date).getTime() - new Date().getTime()) <= ((process.env.CRON_INTERVAL * 2) * 60 * 1000)) {
            throw new Error(`Interval between current date and event date must be greater than ${(process.env.CRON_INTERVAL * 2)} mins.`);
        }
        // store in db
        if (!await UserEventsModel.addUserEvent({
            event_name,
            event_color,
            event_date,
            event_desc,
            event_location,
            user: res.locals.user.id
        })) {
            throw new Error('An error occurred scheduling new event, try again later.');
        }
        res.json(jsonRes({data: `New event has been scheduled. We will email you before event time.`}));
    } catch (error) {
        let errMsg = errHandler(error,'An error occurred scheduling new event, try again later.');
        res.json(jsonRes({error: true, errorMsg: errMsg}));
    }
});

/**
 * route to schedule new event
 */
Route.delete('/schedule/delete/:id', valAuth, valUserCallBack, async (req, res) => {
    try {
        let { id } = req.params;
        const del = await UserEventsModel.deleteUserEvent(id);
        if (!del) {
            throw new Error('Event delete request failed, try again later.');
        }
        res.json(jsonRes({data: 'Resource deleted.'}));
    } catch (error) {
        let errMsg = errHandler(error,'An error occurred scheduling new event, try again later.');
        res.json(jsonRes({error: true, errorMsg: errMsg}));
    }
});

/**
 *  setting route
 */
Route.get('/users', valAuth, valUserCallBack, async (req, res) => {
    res.render('users.ejs', {path: '/users', userData: res.locals.user});
});

/**
 * route to fetch users
 */
Route.get('/users/fetch', valAuth, valUserCallBack, async (req, res) => {
    try {
        let {s = null, l = 50} = req.query;
        if (s && !(validateData(s, /^([\d]+)$/))) {
            throw new Error('Invalid filter parameter, refresh and try again.')
        }
        if (!(validateData(l, /^([\d]+)$/))) {
            throw new Error('Invalid filter parameter, refresh and try again.')
        }
        // get users
        let users = await UsersModel.getUsers(s, (l + 1));
        let more = null;
        if (users.length > l) {
            more = users[users.length - 2].id;
            users.pop();
        }
        res.json(jsonRes({data: {users, more}}));
    } catch (error) {
        let errMsg = errHandler(error,'Users cannot be retrieved at this time, try again later.');
        res.json(jsonRes({error: true, errorMsg: errMsg}));
    }
});

/**
 * route to search users
 */
Route.get('/users/search', valAuth, valUserCallBack, async (req, res) => {
    try {
        let { q = null, l = 50 } = req.query;
        if (!q) {
            throw new Error('No search query passed in request.')
        }
        // search
        const users = await UsersModel.searchUsers(q,l);
        res.json(jsonRes({data: {users, more: null}}));
    } catch (error) {
        let errMsg = errHandler(error,'Unable to process request, try again.');
        res.json(jsonRes({error: true, errorMsg: errMsg}));
    }
});

/**
 * route to enable or disable a user
 */
Route.put('/users/status/:id', valAuth, valUserCallBack, async (req, res) => {
    try {
        let { id } = req.params;
        if (parseInt(id) === res.locals.user.id) {
            throw new Error('Admin account status cannot be altered.');
        }
        const update = await UsersModel.updateUserStatus(id);
        if (!update) {
            throw new Error('User update failed, try again.');
        }
        res.json(jsonRes({data: 'User updated.'}));
    } catch (error) {
        let errMsg = errHandler(error,'Unable to process request, try again.');
        res.json(jsonRes({error: true, errorMsg: errMsg}));
    }
});

/**
 * logout route
 */
Route.get('/logout', (req, res) => {
    return logout(req, res);
});

module.exports = Route;