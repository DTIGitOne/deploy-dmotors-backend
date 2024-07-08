import mongoose from "mongoose";

const carSchema = new mongoose.Schema({
   Seller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
      required: true
   },
   ListingCreation: {
       type: Date,
       default: Date.now,
       requireed: true
   },
   userTittle: {
      type: String,
      required: false
   },
   Brand: {
      type: String,
      required: true
   },
   Model: {
      type: String,
      required: true
   },
   Year: {
      type: Number,
      required: true
   },
   Mileage: {
      type: Number,
      required: true
   },
   Price: {
      type: Number,
      required: true
   },
   VehicleCondition: {
      type: String,
      required: true,
      set: value => value.toLowerCase()
   },
   Category: {
      type: String,
      required: true
   },
   Performance: {
      type: Number,
      required: true
   },
   Drivetrain: {
      type: String,
      required: true
   },
   DriveType: {
      type: String,
      required: true,
      set: value => value.toLowerCase()
   },
   Fuel: {
      type: String,
      required: true,
      set: value => value.toLowerCase()
   },
   VIN: {
      type: String,
      required: true
   },
   TransmitionType: {
      type: String,
      required: true,
      set: value => value.toLowerCase()
   },
   FirstRegistration: {
      type: String, 
      required: true
   },
   Registration: {
      type: String,
      required: true
   },
   SeatNumber: {
      type: Number,
      required: true
   },
   DoorNumber: {
      type: Number,
      required: true
   },
   PollutantClass: {
      type: String,
      required: true
   },
   Owners: {
      type: Number,
      required: true
   },
   ColorManufacturer: {
      type: String,
      required: true
   },
   Color: {
      type: String,
      required: true
   },
   Interior: {
      type: String,
      required: true,
   },
   CarOptions: {
      type: Array,
      required: false,
   },
   CarImages: {
      type: Array,
      required: true,
   },
   AditionalBio: {
      type: String,
      required: false,
   },
}, { collection: 'market'});

export const Car = mongoose.model('market' , carSchema);