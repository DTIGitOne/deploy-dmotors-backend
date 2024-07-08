import jwt from 'jsonwebtoken';
import { config } from 'dotenv';
import { roleHierarchy } from '../Constants/Constants.js';
import { User } from '../Models/userModel.js';
config();

export const authMiddleware = async (req, res, next) => {
   const authorization = req.headers.authorization;
 
   if (!authorization) {
     req.role = 'GUEST';
     return next();
   }
 
   try {
     const parts = authorization.split(" ");
     const token = parts[1];
 
     if (!token) {
       req.role = 'GUEST';
       return next();
     }
 
     const decoded = jwt.verify(token, process.env.JWT_KEY);
 
     if (!decoded) {
       req.role = 'GUEST';
       return next();
     }
 
     const user = await User.findById(decoded._id);
 
     if (!user) {
       req.role = 'GUEST';
       return next();
     }
 
     req.user = decoded;
     req.role = user.role;
 
     next();
   } catch (e) {
     req.role = 'GUEST';
     next();
   }
 };

export const roleMiddleware = ( requiredRole ) => {
   return ( req , res , next) => {
      const userRole = req.role;
      if (roleHierarchy[userRole] === undefined) {
         return res.status(403).send("Forbidden");
       }

       if (roleHierarchy[userRole] < roleHierarchy[requiredRole]) {
         return res.status(403).send("Forbidden");
       }
      next();
   }
};
