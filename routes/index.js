var express = require("express"),
	session = require("express-session"),
	passport = require("passport"),
	app = express(),
	router = express.Router();
	
const controller = require('./controller')


app.set("views", __dirname + "/public/views");
app.set("view engine", "ejs");


app.use('/routes', express.static(__dirname + '/routes'));

app.use(passport.initialize());
app.use(passport.session());
app.use(session({
	secret: "OAuth Session",
	saveUninitialized: true,
	resave: true
}));

passport.serializeUser(function (user, done) {
	done(null, user);
});

passport.deserializeUser(function (obj, done) {
	done(null, obj);
});

/* GET home page. */
router.get('/video-cut-tool-back-end', function (req, res) {
	res.render('index');
});

router.post('/send', controller.sendCallback);
router.post('/video-cut-tool-back-end/send', controller.sendCallback);
router.post('/video-cut-tool-back-end/video-cut-tool-back-end/send', controller.sendCallback);

router.post('/send/upload', controller.uploadFileSendCallback);
router.post('/video-cut-tool-back-end/send/upload', controller.uploadFileSendCallback)
router.post('/video-cut-tool-back-end/video-cut-tool-back-end/send/upload', controller.uploadFileSendCallback);


router.post('/video-cut-tool-back-end/video_processed', controller.onVideoProcessed);
router.post('/video_processed', controller.onVideoProcessed);

router.get('/download/public/:videopath', function(req, res){
	const file = 'public/'+req.params.videopath;
	res.download(file); // Set disposition and send it.
});

router.get('/video-cut-tool-back-end/download/public/:videopath', controller.downloadFile);

router.get('/insert', function (req, res) {
	res.render('index');
});

router.get('/video-cut-tool-back-end/insert', function (req, res) {
	res.render('index');
});

router.get(['/video-cut-tool-back-end/video-cut-tool-back-end/login', '/video-cut-tool-back-end/login'], passport.authenticate('mediawiki'), () => {});

router.get("/", function (req, res) {
	res.redirect(req.baseUrl + '/video-cut-tool-back-end/');
});

router.get('/video-cut-tool-back-end/video-cut-tool-back-end/auth/mediawiki/callback', passport.authenticate('mediawiki', {
	failureRedirect: '/login',
}), controller.authCallback)

router.get('/video-cut-tool-back-end/auth/mediawiki/callback', passport.authenticate('mediawiki', {
	failureRedirect: '/login',
}), controller.authCallback)

router.get('/auth/mediawiki/callback', passport.authenticate('mediawiki', {
	failureRedirect: '/login',
}), controller.authCallback)

module.exports = router;
