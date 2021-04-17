const mocha = require('mocha');
const assert = require('assert');

const UserModel = require('../models/User');

describe('DB Saving records', function() {

    it('Saves a record to the database', function(done){
        var char = new UserModel({
            id: "TestId",
            username: 'TestUser'
        });
        
        char.save().then(function(){
            assert(char.isNew === false);
            done();
        }).catch(done);
    });
}); 
