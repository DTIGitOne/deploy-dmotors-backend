import { vehicleOptions } from "../Data/VehicleOptions.js";
import { ROLES } from "../Constants/Constants.js";
import { emailRegex , VINRegex , firstRegistrationRegex , letterCheckRegex , mongoStringRegex , numberRegex } from "./regexFile.js";
import crypto from 'crypto';

// check if email is valid //////////////////////////////////////////////////////////
export const isValidEmail = (email) => {
   return emailRegex.test(email);
};

// check if VIN string is valid //////////////////////////////////////////////////////////

export function isValidVIN(vin) {
   return VINRegex.test(vin);
}

// get current year /////////////////////////////////////////////////

export const currentYear = new Date().getFullYear();

// check first registartion /////////////////////////////////////////////////

export function isValidFirstRegistration(registration) {
   return firstRegistrationRegex.test(registration);
};

// split registration and check /////////////////////////////////////////////////

export function parseRegistration(registration) {
   const parts = registration.split('/');

   const RegistrationPart1 = parseInt(parts[0], 10);
   const RegistrationPart2 = parseInt(parts[1], 10);

   return { RegistrationPart1, RegistrationPart2 };
}

// check letter /////////////////////////////////////////////////

export function isValidLetters(string) {
   return letterCheckRegex.test(string);
};

// mongo check /////////////////////////////////////////////////

export function isValidMongoString(string) {
   return mongoStringRegex.test(string);
};

// random 6 digit number /////////////////////////////////////////////////

export function generateRandomSixDigitNumber() {
   return Math.floor(100000 + Math.random() * 900000);
}

// check if number /////////////////////////////////////////////////

export function isValidNumberCode(string) {
   return numberRegex.test(string);
};

// check for vehicle options /////////////////////////////////////////////////

export function validateOptions(inputOptions) {
   const invalidItems = inputOptions.filter(item => !vehicleOptions.includes(item));

   if (invalidItems.length > 0) {
      throw new Error(`Invalid options: ${invalidItems.join(', ')}`);
   } else {
       return "All items match";
   }
};

// check role /////////////////////////////////////////////////

export function checkRoles(role) {
   const invalidRole = role.filter(r => !ROLES.includes(r));

   if(invalidRole.length > 0) {
      return false;
   } else {
      return "Role correct";
   };
};

// random image name /////////////////////////////////////////////////

export const randomImageName = (bytes = 32) => crypto.randomBytes(bytes).toString('hex');


