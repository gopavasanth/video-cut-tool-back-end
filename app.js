const express = require('express');
const path = require('path');
const favicon = require('serve-favicon');
const logger = require('morgan');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const cors = require('cors'); // addition we make
const fileUpload = require('express-fileupload'); //addition we make
config = require( "./config" );

const index = require('./routes/index');
const users = require('./routes/users');
const login = require('./routes/login');
const app = express();

var passport = require( "passport" ),
    MediaWikiStrategy = require( "passport-mediawiki-oauth" ).OAuthStrategy,
    session = require( "express-session" );

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

// uncomment after placing your favicon in /public
//app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());

// Use CORS and File Upload modules here
app.use(cors());
app.use(fileUpload());

app.use( passport.initialize() );
app.use( passport.session() );

app.use( session({ secret: "OAuth Session",
    saveUninitialized: true,
    resave: true
}) );

//app.use( "/nodejs-mw-oauth-tool", router );

passport.use(
    new MediaWikiStrategy({
        consumerKey: config.consumer_key,
        consumerSecret: config.consumer_secret
    },
    function ( token, tokenSecret, profile, done ) {
        profile.oauth = {
            consumer_key: config.consumer_key,
            consumer_secret: config.consumer_secret,
            token: token,
            token_secret: tokenSecret
        }, (accessToken, refreshToken, profile, done) => {
            console.log('passport callback function fired');
            console.log(profile);
            new User({
                username: profile.displayName,
                id: profile.id
            }).save().then((newUser) => {
                console.log("New User Created: " + newUser);
            });
        }
        return done( null, profile );
    })  
);

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
}
); // login

app.get( "/video-cut-tool-back-end/login", function ( req, res ) {
    res.redirect( "/video-cut-tool-back-end/auth/mediawiki/callback" );
} );

app.get('/video-cut-tool-back-end/auth/mediawiki/callback', function(req, res, next) {
  passport.authenticate( "mediawiki", function( err, user ) {
        if ( err ) {
            return next( err );
        }

        if ( !user ) {
            return res.redirect( req.baseUrl + "/login" );
        }

    } )( req, res, next );
});

// catch 404 and forward to error handler
app.use(function(req, res, next) {
const err = new Error('Not Found');
err.status = 404;
next(err);
});

// error handler
app.use(function(err, req, res, next) {
// set locals, only providing error in development
res.locals.message = err.message;
res.locals.error = req.app.get('env') === 'development' ? err : {};

// render the error page
res.status(err.status || 500);
res.render('error');
});

module.exports = app;