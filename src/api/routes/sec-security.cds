// 1. Import the data model
using {sec as mysec} from '../models/sec-users';

// 2. Import the controller to implement the Logic
@impl: 'src/api/controllers/sec-security-controller'

// 3. Define the method to expose the routes
// for all APIs of user security

service securityRouter @(path: '/api/security') {

    // 4. Instance the users entity
    entity entusers as projection on mysec.users;

    @Core.Description: 'get-Catalog'
    @path            : 'catalogs'
    function catalogs()                   returns array of entusers;

    @Core.Description: 'get-users'
    @path            : 'users'
    function users()                      returns array of entusers;

    @Core.Description: 'create-user'
    @path            : 'createuser'
    action   createuser(users : entusers) returns array of entusers;
};
