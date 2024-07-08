import verificationCountModel from "../Models/verificationCountModel.js";
import { User } from "../Models/userModel.js";

export const sentEmailCounter = async ( user ) => {
   try {
         const existingCounter = await verificationCountModel.findOne({user: user});

         const doesUserExist = await User.findById(user);

         if(!doesUserExist) {
            throw new Error(`User dosent exist`);
         }

      if (!existingCounter) {
         try {
            await verificationCountModel.create({  user: user, counter: 1 });
         } catch (e) {
            throw new Error(`Failed to save new counter, ${e}`);
         };
      } else {
         let currentCount = parseInt(existingCounter.counter);
         
         if(currentCount >= 3) {
            throw new Error(`Too many requests.Wait a little time before trying again`);
         };

         currentCount++

         try {
            await verificationCountModel.findByIdAndUpdate(existingCounter._id, { counter: currentCount });
         } catch (e) {
            throw new Error(`Failed to update counter: ${e}`);
         }
      };

   } catch (e) {
      throw new Error(`Error in sentEmailCounter: ${e}`);
   };
};