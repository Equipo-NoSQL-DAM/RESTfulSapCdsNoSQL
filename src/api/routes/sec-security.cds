// 1. Import the data model
using {sec as mysec} from '../models/sec-users';
using {secValues as myval} from '../models/sec-values';
using {secRoles as myroles} from '../models/sec-roles';
using {catLabels as mylabels} from '../models/cat-label';


// 2. Import the controller to implement the Logic
@impl: 'src/api/controllers/sec-security-controller'

// 3. Define the method to expose the routes
// for all APIs of user security

service securityRouter @(path: '/api/security') {

    // 4. Instance the users entity
    entity entusers  as projection on mysec.users;
    entity entvalues as projection on myval.values;
    entity entroles  as projection on myroles.Roles;
    entity entlabels  as projection on mylabels.labels;


    @Core.Description: 'crud-users'
    @path            : 'crudUsers'
    action crudUsers(users : entusers)    returns array of entusers;

    @Core.Description: 'crud-values'
    @path            : 'crudValues'
    action crudValues(values : entvalues) returns array of entvalues;

    @Core.Description: 'crud-roles'
    @path            : 'crudRoles'
    action crudRoles(roles : entroles)    returns array of entroles;

    @Core.Description: 'delete-fisico-logico'
    @path            : 'deleteAny'
    action deleteAny()                    returns array of entusers;

    @Core.Description: 'crud-labels'
    @path            : 'crudLabels'
    action crudLabels(labels : entlabels) returns array of entlabels;

    

};
