# aws-rotate-eips
Script to "fake" the generation of dynamic IP addresses in EC2 instances.

**Brief history**

I have started working in a project where I need to create an instance (or a set of instances) with 2 static IP addresses (that will never change) and 2 dynamic IP addresses (that will change every now and then). Amazon offers dynamic IP addresses but only the first time you create an instance and **only if you have one ENI** . This is obviously a problem because it means that if you want to have a dynamic IP generated by AWS you'll be able to have only 1 ENI.
The other problem is that, every time you reboot your instance (or stop it and then start it again) the IP will change. This might or might not be what you want but this script solves the problem of having multiple dynamic IP addresses on an instance with more than one ENI.
The idea is to use the AWS API to request a new IP address, disassociate the IP from an ENI and then associate it the newly requested IP with the ENI.

For the purposes of this script I'm assuming that you are going to work only with t2.nano or t2.micro instances which support a maximum of 2 ENIs and 2 EIPs/ENI which makes a total of 4 EIPs/machine.

**Getting to work**

First of all you have to enter your AWS credentials if your computer doesn't have the aws-cli configured (if you are working with the aws-cli simply run **aws configure** and it'll ask you for your keys and Availability Zones (AZ)
There is a file named **enis.json** where you can insert the EIP IDs you want to work with. The purpose of this file is to choose an ENI randomly from your pool of ENIs and replace a random EIP in that ENI.

If you are going to use any of those files remember to make a copy of them and remove the .example extension.

Once you have done it simply run

>npm install

And the system will automatically download and install the aws-sdk (skip this step if you already have the aws-sdk installed).
You can then run the following command

>./app.js

To change the EIPs of your instances.

I know that the requirements of this script are very specific so feel free to fork me if you find it useful and you want to change it!


