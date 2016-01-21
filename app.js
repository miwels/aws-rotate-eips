#!/usr/bin/env node

//  This script allows you to automate the task of rotating IP addresses between
//  instances. The idea is to have a "dynamic" pool of IP addresses that this script
//  will change.
//
//  Before running this script make sure that you enter the ENI IDs in the file enis.json
//  and also that all your ENIs have an EIP associated. The script will try to pull a
//  random ENI from the list enis.json and then attempt to disassociate an EIP so that
//  the ENI has a free slot to be assigned to another EIP.
//  Also, make sure that all your ENIs have an EIP associated before running the script
//  because it will throw an error otherwise.
//
//  The process is the following:
//  1. Request a new EIP
//  2. If the request is successful, find a random ENI from the list of enis (enis.json)
//  3. Find a random EIP associated with the ENI and disassociate it.
//  4. Associate the new EPI requested in the step (1)
//  5. Release the old EIP
//
//  After this we have to update our Route53 table to make sure that our domain
//  points to the right EIP.
//
//  @todo
//  In the new version of the SDK, releasing an EIP disassociates automatically
//  the EIP from the ENI so we can skip this step.
//
//  @todo
//  Due to the fact that we have a limited pool of EIPs in our account (16 currently)
//  we should release the old EIP first and then request a new EIP because if not
//  we won't have space in our account to host the EIP while we update the ENI


var AWS  = require('aws-sdk');
var enis = require('./enis');

//  Remember that we should never include credentials in git repositories
//  If we just need to update the region we can do:
//  AWS.config.update({region: 'us-east-1'});

var awsCredentialsPath = './aws.credentials.json';
AWS.config.loadFromPath(awsCredentialsPath);

var ec2 = new AWS.EC2();

// choose a random ENI from our list of dynamic ENIs
var eniIndex = Math.floor(Math.random() * enis.dynamic.length);
var eniToReplace = enis.dynamic[eniIndex];

// retrieve a new address
var newAddress;

ec2.allocateAddress({
    Domain: 'vpc'
}, function (err, data) {
    if (err) console.log(err, err.stack);

    // release and reassign the IP only if we've managed to request a new IP
    newAddress = data;
    releaseAndReassignIpAddress(data);
});

//  After requesting a new EIP this function is called. The function takes
//  the information of the new EIP as an argument so that it can pass it to
//  the next set of functions that will associate the new EIP.
//
//  This function simply reads the list of dynamic ENIs (enis.json), finds the
//  ID of a random ENI and then it finds a random EIP in that ENI to remplace with
//  the new IP.
var releaseAndReassignIpAddress = function (newIpData) {

    // find the association ID of that ENI
    ec2.describeNetworkInterfaces({
        NetworkInterfaceIds : [eniToReplace]
    }, function (err, data) {
        if (err) {
            console.log(err.stack);
        }
        else {
            // disassociate the ENI, retrieve a new EIP and associate it
            // we know that each ENI has 2 EIPs so we can grab a random association
            var ipAddresses = data.NetworkInterfaces[0].PrivateIpAddresses;
            var randomIpAddressIndex = Math.floor(Math.random() * ipAddresses.length);

            // this should never happen but let's add an exception if the ENI has
            // no associations
            if(ipAddresses[randomIpAddressIndex].Association === undefined) {
                throw Error("The selected ENI has no associations.");
                process.exit(1);
            }

            var privateIp   = ipAddresses[randomIpAddressIndex].PrivateIpAddress;
            var association = ipAddresses[randomIpAddressIndex].Association;

            disassociateReleaseAndAssociateNewIp({
                Eni          : eniToReplace,
                AssociationId: association.AssociationId,
                AllocationId : association.AllocationId,
                PublicIp     : association.PublicIp,
                PrivateIp    : privateIp,
                NewIp        : newIpData
            });
        }
    });

};

//  Once we know which ENI we want to update, this function is called.
//  The function just disassociates the old EIP, associates the new one
//  and then it releases the old EIP so that we don't get charged extra
//  for having unused EIPs (read AWS ENI documentation)
var disassociateReleaseAndAssociateNewIp = function (obj) {

    // disassociate the old address
    // note: we can specify AssociationId or PublicIp but not both
    ec2.disassociateAddress({
        AssociationId : obj.AssociationId
    }, function (err, data) {
        if (err) console.log(err.stack);

        // now that we have disassociated the IP address from the instance
        // we have to allocate the new address. We can specify the allocation
        // ID or the PublicIp but not both. If you need the PublicIp is here:
        // PublicIp : obj.NewIp.PublicIp,

        ec2.associateAddress({
            AllocationId : obj.NewIp.AllocationId,
            AllowReassociation: false,
            NetworkInterfaceId: eniToReplace,
            PrivateIpAddress : obj.PrivateIp
        }, function (err, data) {
            if (err) console.log(err.stack);

            // once we have allocated the new address we can release the old
            // one to avoid hitting the account limits (and to avoid being charged
            // for unused IPs!!!)
            // again, send only AllocationId OR PublicIp but not both
            ec2.releaseAddress({
                AllocationId : obj.AllocationId,
            }, function (err, data) {
                if (err) console.log(err.stack);

                console.log("ENI " + eniToReplace + " has been updated.");
                console.log("Old IP: " + obj.PublicIp);
                console.log("New IP: " + obj.NewIp.PublicIp);
            });

        });

    });
};

// helper to print out all the JSON data AWS returns (it's useful to copy
// the JSON returned and paste it in an online parser)
var log = function (data) {
    return console.log(JSON.stringify(data));
};