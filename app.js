const express = require('express');
const path = require('path');
const logger = require('morgan');
const mongoose = require('mongoose');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const cors = require('cors'); // addition we make
const fileUpload = require('express-fileupload'); //addition we make
config = require( "./config" );

const index = require('./routes/index');
const app = express();

var passport = require( "passport" ),
    MediaWikiStrategy = require( "passport-mediawiki-oauth" ).OAuthStrategy,
    session = require( "express-session" );

mongoose.connect(config.DB_CONNECTION_URL)
const UserModel = require('./models/User');
const VideoModel = require('./models/Video');
// view engine setup
app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');
app.use(express.static(path.join(__dirname, 'public')));
app.use('/public', express.static(path.join(__dirname, 'public')));
app.use('/video-cut-tool-back-end/public', express.static(path.join(__dirname, 'public')));

app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());

// Use CORS and File Upload modules here
app.use(cors());
app.use(fileUpload({
  useTempFiles : true,
  tempFileDir : 'tmp/', // so that they're publicly accessable
  limits: { fileSize: 50 * 1024 * 1024 },
  abortOnLimit: true
}));

app.use( passport.initialize() );
app.use( passport.session() );

app.use(
  session({
    secret: "OAuth Session",
    saveUninitialized: true,
    resave: true
  })
);

passport.use(new MediaWikiStrategy({
  baseURL: 'https://commons.wikimedia.org/',
  consumerKey: config.consumer_key,
  consumerSecret: config.consumer_secret
},
  (token, tokenSecret, profile, done) => {
    // asynchronous verification, for effect...
    process.nextTick(() => {
      const newUserData = { mediawikiId: profile.id, username: profile.displayName, mediawikiToken: token, mediawikiTokenSecret: tokenSecret };
      return done(null, newUserData);
    })
  },
))

passport.serializeUser( function ( user, done ) {
  done( null, user );
});

passport.deserializeUser( function ( obj, done ) {
  done( null, obj );
});

app.use('/routes', express.static(__dirname + '/routes'));

app.use('/', index);
app.use('/login', (req, res) => {
  console.log("sample requst");
  res.send(res.redirect( req.baseUrl + "/auth/mediawiki/callback" ))
}); // login

app.get( "/logout" , function ( req, res ) {
	delete req.session.user;
	res.redirect( req.baseUrl + "/" );
} );

app.get('/video-cut-tool-back-end', function(req, res) {
  res.render('index');
});

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  const err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handler
app.use(function(err, req, res) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};
  console.log(err);
  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;
