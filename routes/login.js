var express = require( "express" ),
	session = require( "express-session" ),
	passport = require( "passport" ),
	MediaWikiStrategy = require( "passport-mediawiki-oauth" ).OAuthStrategy,
	config = require( "./config" ),

	app = express(),
	router = express.Router();

app.set( "views", __dirname + "/public/views" );
app.set( "view engine", "ejs" );
app.use( express.static(__dirname + "/public/views") );

app.use( passport.initialize() );
app.use( passport.session() );

app.use( session({ secret: "OAuth Session",
	saveUninitialized: true,
	resave: true
}) );

app.use( "/nodejs-mw-oauth-tool", router );

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
		};
		return done( null, profile );
	}
	) );

passport.serializeUser(	function ( user, done ) {
	done( null, user );
});

passport.deserializeUser( function ( obj, done ) {
	done( null, obj );
});

router.get( "/", function ( req, res ) {
	res.render( "index", {
		user: req && req.session && req.session.user,
		url: req.baseUrl
	} );
} );

router.get( "/login", function ( req, res ) {
	res.redirect( req.baseUrl + "/auth/mediawiki/callback" );
} );

router.get( "/auth/mediawiki/callback", function( req, res, next ) {
	passport.authenticate( "mediawiki", function( err, user ) {
		if ( err ) {
			return next( err );
		}

		if ( !user ) {
			return res.redirect( req.baseUrl + "/login" );
		}

		req.logIn( user, function( err ) {
			if ( err ) {
				return next( err );
			}
			req.session.user = user;
			res.redirect( req.baseUrl + "/" );
		} );
	} )( req, res, next );
} );

router.get( "/logout" , function ( req, res ) {
	delete req.session.user;
	res.redirect( req.baseUrl + "/" );
} );

module.export = router;
