import { config } from "dotenv";
import nodemailerExpressHandlebars from 'nodemailer-express-handlebars';
import path from 'path';
import nodemailer from 'nodemailer';
config();

export const sendMailFunc = async (code, Useremail) => {

   const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
         user: process.env.GMAIL_USER,
         pass: process.env.GMAIL_KEY
      }
   });

   const hbsOptions = {
      viewEngine: {
          extname: '.hbs',
          defaultLayout: false,
      },
      viewPath: path.resolve('mail'),
      extName: '.hbs',
  };

  transporter.use('compile', nodemailerExpressHandlebars(hbsOptions));

   await transporter.sendMail({
      from: process.env.GMAIL_USER,
      to: Useremail,
      subject: "Email verification",
      template: 'mail',
      context: {
         code: code,
         currentYear: new Date().getFullYear(),
      },
   });
};

export const sendForgotMailFunc = async (Useremail, resetLink) => {
   const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
         user: process.env.GMAIL_USER,
         pass: process.env.GMAIL_KEY
      }
   });

   const hbsOptions = {
      viewEngine: {
          extname: '.hbs',
          defaultLayout: false,
      },
      viewPath: path.resolve('mail'),
      extName: '.hbs',
  };

  transporter.use('compile', nodemailerExpressHandlebars(hbsOptions));

   await transporter.sendMail({
      from: process.env.GMAIL_USER,
      to: Useremail,
      subject: "Forgot password",
      template: 'forgot',
      context: {
         resetLink: resetLink,
         currentYear: new Date().getFullYear(),
      },
   });
};