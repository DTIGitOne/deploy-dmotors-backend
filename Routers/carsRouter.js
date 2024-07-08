import express from 'express';
import { Car } from '../Models/carModel.js';
import { User } from '../Models/userModel.js';
import { validBrands } from '../Data/Brands.js';
import { brandModels } from '../Data/Models.js';
import { config } from 'dotenv';
import { roleMiddleware , authMiddleware } from '../Middleware/auth.js';
import { currentYear , isValidVIN, parseRegistration , isValidMongoString , validateOptions, randomImageName } from '../Functions/Functions.js';
import { CategoryList } from '../Data/Category.js';
import { driveTrainList } from '../Data/DriveTrain.js';
import { fuelTypeList } from '../Data/Fuel.js';
import { firstRegistrationRegex } from '../Functions/regexFile.js';
import { pollutantClassList } from '../Data/Pollutant.js';
import multer from 'multer';
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectsCommand } from '@aws-sdk/client-s3';
import sharp from 'sharp';
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { carImageUrlSearch } from '../Middleware/carImageUrl.js';
import { Recommended } from '../Models/RecommencedModel.js';
import { getRandomCars } from '../Functions/randomCars.js';
config();

const carsRouter = express.Router();

const storage = multer.memoryStorage();
const upload = multer({
   storage: storage,
   limits: { fileSize: 5 * 1024 * 1024 },
});
 
const s3 = new S3Client({
   credentials: {
      accessKeyId: process.env.ACCESS_KEY,
      secretAccessKey: process.env.SECRET_ACCESS,
   },
   region: process.env.BUCKET_LOCATION
});

//filter cars ///////////////////////////////////////////////////////

carsRouter.get('/search', authMiddleware, roleMiddleware("GUEST"), async (req, res) => {
   try {
       const {
           Brand, Model, Year, Milage, minPrice, maxPrice, VehicleCondition,
           Category, minPerformance, maxPerformance, Drivetrain, DriveType, Fuel, TransmitionType,
           Registration, SeatNumber, DoorNumber, PollutantClass,
           Owners, ColorManufacturer, Color, Interior, CarOptions,
           page = 1, limit = 10
       } = req.query || {};

       const query = {};

       if (Brand) query.Brand = Brand;
       if (Model) query.Model = Model;
       if (Year) query.Year = parseInt(Year, 10);
       if (Milage) query.Mileage = { $lte: parseInt(Milage, 10) };
       if (minPrice) query.Price = { $gte: parseInt(minPrice, 10) };
       if (maxPrice) {
           query.Price = query.Price || {};
           query.Price.$lte = parseInt(maxPrice, 10);
       }
       if (VehicleCondition) query.VehicleCondition = VehicleCondition;
       if (Category) query.Category = Category;
       if (minPerformance) query.Performance = { $gte: parseInt(minPerformance, 10) };
       if (maxPerformance) {
           query.Performance = query.Performance || {};
           query.Performance.$lte = parseInt(maxPerformance, 10);
       }
       if (Drivetrain) query.Drivetrain = Drivetrain;
       if (DriveType) query.DriveType = DriveType;
       if (Fuel) query.Fuel = Fuel;
       if (TransmitionType) query.TransmitionType = TransmitionType;
       if (Registration) query.Registration = Registration;
       if (SeatNumber) query.SeatNumber = SeatNumber;
       if (DoorNumber) query.DoorNumber = DoorNumber;
       if (PollutantClass) query.PollutantClass = PollutantClass;
       if (Owners) query.Owners = { $lte: parseInt(Owners, 10) };
       if (ColorManufacturer) query.ColorManufacturer = ColorManufacturer;
       if (Color) query.Color = Color;
       if (Interior) query.Interior = Interior;
       if (CarOptions) {
           const carOptionsArray = Array.isArray(CarOptions) ? CarOptions : [CarOptions];
           query.CarOptions = { $in: carOptionsArray };
       }

       const countPromise = Car.countDocuments(query); 
       const carsPromise = Car.find(query).skip((parseInt(page, 10) - 1) * parseInt(limit, 10)).limit(parseInt(limit, 10));

       const [total, cars] = await Promise.all([countPromise, carsPromise]);

       for (const car of cars) {
           if (car.CarImages.length > 0) {
               const firstImageKey = car.CarImages[0];
               const getObjectParams = {
                   Bucket: process.env.BUCKET_NAME,
                   Key: firstImageKey,
               };
               const command = new GetObjectCommand(getObjectParams);
               const url = await getSignedUrl(s3, command, { expiresIn: 3600 });
               car.CarImages = [url]; 
           }
       }

       res.status(200).send({ cars, total });
   } catch (e) {
       console.error('An error occurred while searching for cars:', e);
       res.status(500).send({ error: 'An error occurred while searching for cars', details: e.message });
   }
});

//get cars //////////////////////////////////////////////////////////

carsRouter.get('/', authMiddleware, roleMiddleware("GUEST") , async (req , res) => {
   try {
      const findCars = await carImageUrlSearch();
      res.status(200).send({findCars});
   } catch (e) {
      res.status(400).send({errorMessage: "an error has accured"});
   }
});

//get car //////////////////////////////////////////////////////////

carsRouter.get('/:_id', authMiddleware, roleMiddleware("GUEST"), async (req, res) => {
   const { _id } = req.params;
   const userRole = req.role;
 
   try {
     const car = await carImageUrlSearch(null, _id);

     const findCar = await Car.findById(_id)

     if (!car) {
       return res.status(404).send({ message: 'Car not found' });
     }
 
     if (userRole !== "GUEST") {
      const userIdToken = req.user._id;
      const userIdTokenString = userIdToken.toString();

       const findRecommended = await Recommended.findOne({ SelectedUser: userIdTokenString });
 
       if (findRecommended) {
         let brandArray = findRecommended.Brand || [];
         let modelArray = findRecommended.Model || [];
         let currentIndex = findRecommended.currentIndex || 0;
      
         const maxLength = 3;
      
         const updateRotatingArray = (array, item) => {
            if (array.length < maxLength) {
               array.push(item);
            } else {
               array[currentIndex] = item; 
            }
            currentIndex = (currentIndex + 1) % maxLength; 
         };
      
         updateRotatingArray(brandArray, findCar.Brand);
         updateRotatingArray(modelArray, findCar.Model);
      
         findRecommended.Brand = brandArray;
         findRecommended.Model = modelArray;
         findRecommended.currentIndex = currentIndex;
      
         try {
            const updatedRecommended = await findRecommended.save();
         } catch (error) {
            console.error('Error saving updated Recommended:', error);
            throw error; 
         }
      } else {
         const CreateNewRecommended = new Recommended({
            SelectedUser: userIdTokenString,
            Brand: [findCar.Brand],
            Model: [findCar.Model],
            currentIndex: 0 
         });
      
         try {
            const savedNewRecommended = await CreateNewRecommended.save();
            console.log('Created New Recommended:', savedNewRecommended);
         } catch (error) {
            console.error('Error saving new Recommended:', error);
            throw error; 
         }
      }
      
     }
 
     res.status(200).send({ car });
   } catch (e) {
     res.status(500).send({ error: `An error occurred (Vehicle with the id:${_id} does not exist)`, message: "Vehicle does not exist" });
   }
 });

//add new car //////////////////////////////////////////////////////////

carsRouter.post('/create', authMiddleware, upload.array('CarImages', 10), roleMiddleware("CLIENT") , async (req , res) => {
   let { 
      Seller, userTittle, Brand, BrandModel, Model, Year, Mileage, Price, VehicleCondition, Category, Performance,
      Drivetrain, DriveType, Fuel, VIN, TransmitionType, FirstRegistration, 
      Registration, SeatNumber, DoorNumber, PollutantClass, Owners, ColorManufacturer, Color, 
      Interior, CarOptions , AditionalBio
  } = req.body || {};

  const userIdToken = req.user._id;
  const userIdTokenString = userIdToken.toString(); 

  if(Seller !== userIdTokenString) return res.status(400).send({Messsage: "You can only create postings for your account"});
  
   ////////////////////////////////////////////////////////////
   if(!Seller) return res.status(400).send({Messsage: "Please login to create a posting"});
   if(!isValidMongoString(Seller)) {
      return res.status(400).send({ Message: "String ID is not correct" });
   }

   const sellerExists = await User.findById(Seller);
   if (!sellerExists) {
      return res.status(400).send({ Message: "Seller does not exist" });
   }
   ////////////////////////////////////////////////////////////
   if(!VIN) return res.status(400).send({VINMesssage: "VIN is missing"});
   if(!isValidVIN(VIN)) {
      return res.status(400).send({VINMesssage: "VIN is incorrect"});
   }
 
   ////////////////////////////////////////////////////////////
   if(!Brand) return res.status(400).send({brandMesssage: "Brand is missing"});
   const brandCheck = Brand.toLowerCase();
   if (!validBrands.includes(brandCheck)) {
      return res.status(400).send({ message: "Invalid brand" });
   }

   ////////////////////////////////////////////////////////////
   if(!Model) return res.status(400).send({modelMesssage: "Model is missing"});
   const normalizedBrand = BrandModel.toLowerCase();
   const normalizedModel = Model.toLowerCase();
   console.log(normalizedBrand);
   console.log(normalizedModel);
   if (!brandModels[normalizedBrand] || !brandModels[normalizedBrand].includes(normalizedModel)) {
      return res.status(400).send({ message: `Invalid model '${Model}' for brand '${Brand}'` });
   }
   ////////////////////////////////////////////////////////////

   if(!Year) return res.status(400).send({yearMesssage: "Year is missing"});
   if(Year < 1950) return res.status(400).send({yearMesssage: "Year is too low"});
   if(Year > currentYear) return res.status(400).send({yearMesssage: "Year is too high"});

   ////////////////////////////////////////////////////////////
   if(!Mileage) return res.status(400).send({mileageMesssage: "Mileage is missing"});
   if(Mileage.length > 8) res.status(400).send({mileageMesssage: "Mileage cant be over 99,999,999"});

   ////////////////////////////////////////////////////////////
   if(!Price) return res.status(400).send({priceMesssage: "Price is missing"});
   if(Price > 99999999)  return res.status(400).send({priceMesssage: "Price is too high"});
   if(Price < 1)  return res.status(400).send({priceMesssage: "Price is too low"});

   ////////////////////////////////////////////////////////////
   if(!VehicleCondition) return res.status(400).send({vehicleConditionMessage: "Vehicle condition is missing"});
   if(VehicleCondition !== "Used(pre-owned)" && VehicleCondition !== "New")  return res.status(400).send({vehicleConditionMessage: "Incorrect vehicle condition"});

   ////////////////////////////////////////////////////////////
   if(!Category) return res.status(400).send({performanceMessage: "Vehicle category is missing"});
   const caregoryCheck = Category.toLowerCase();
   if(!CategoryList.includes(caregoryCheck)) return res.status(400).send({performanceMessage: "Incorrect vehicle category"});

   ////////////////////////////////////////////////////////////
   if(!Performance) return res.status(400).send({performanceMessage: "Vehicle performance is missing"});
   if(!Performance > 10000) return res.status(400).send({performanceMessage: "Vehicle performance is too high"});

   ////////////////////////////////////////////////////////////
   if(!Drivetrain) return res.status(400).send({drivetrainMessage: "Drivetrain type is missing"});
   const drivetrainCheck = Drivetrain.toLowerCase();
   if(!driveTrainList.includes(drivetrainCheck)) return res.status(400).send({drivetrainMessage: "Drivetrain type is incorrect"});

   ////////////////////////////////////////////////////////////
   if(!DriveType) return res.status(400).send({drivetypeMessage: "Drive type is missing"});
   const normalizedDriveType = DriveType.toLowerCase();
   if(normalizedDriveType !== "combustion" && normalizedDriveType !== "electric" && normalizedDriveType !== "hybrid") return res.status(400).send({drivetypeMessage: "Drive type is incorrect"});

   ////////////////////////////////////////////////////////////
   if(!Fuel) return res.status(400).send({fuelMessage: "Fuel type is missing"});
   if (!fuelTypeList[normalizedDriveType] || !fuelTypeList[normalizedDriveType].includes(Fuel)) {
      return res.status(400).send({ fuelMessage: `Invalid fuel type '${Fuel}' for '${DriveType}'` });
   }

   ////////////////////////////////////////////////////////////
   if(!TransmitionType) return res.status(400).send({transmitionTypeMessage: "Transmition type is missing"});
   const normalizedTransmitionType = TransmitionType.toLowerCase();
   if(normalizedTransmitionType !== "manual" && normalizedTransmitionType !== "automatic") return res.status(400).send({transmitionTypeMessage: "Transmition type is incorrect"});

   ////////////////////////////////////////////////////////////
   if(!FirstRegistration) return res.status(400).send({registrationFirstMessage: "First registration is missing"});
   if(FirstRegistration !== "Never registerd") {
      if(!firstRegistrationRegex.test(FirstRegistration)) {
         return res.status(400).send({registrationFirstMessage: "First registration is incorrect"});
      };
   
      const { RegistrationPart1 , RegistrationPart2 } = parseRegistration(FirstRegistration);
   
      if(RegistrationPart1 < 1 || RegistrationPart1 > 12) return res.status(400).send({registrationFirstMessage: "Month is incorrect"});
      if(RegistrationPart2 < 1950 || RegistrationPart2 > currentYear) return res.status(400).send({registrationFirstMessage: "Year is incorrect"});

   };

   ////////////////////////////////////////////////////////////
   if(!Registration) return res.status(400).send({registrationMessage: "Registration is missing"});
   if(Registration !== "Not registerd") {
      if(!firstRegistrationRegex.test(Registration)) {
         return res.status(400).send({registrationMessage: "Registration is incorrect"});
      };
   
      const { RegistrationPart1 , RegistrationPart2 } = parseRegistration(Registration);

      const maxRegistrationYear = currentYear + 5;
      if(RegistrationPart1 < 1 || RegistrationPart1 > 12) return res.status(400).send({registrationMessage: "Month is incorrect"});
      if(RegistrationPart2 < 1950 || RegistrationPart2 > maxRegistrationYear) return res.status(400).send({registrationMessage: "Year is incorrect"});

       // add first registration to current ////////////////////////////////////////////////////////////
      if(FirstRegistration === "Never registerd") {
         FirstRegistration = Registration;
      };

      };
   
   ////////////////////////////////////////////////////////////
   if(!SeatNumber) return res.status(400).send({seatNumberMessage: "Seat number is missing"});
   if(SeatNumber > 10) return res.status(400).send({seatNumberMessage: "Seat number is too high"});

   ////////////////////////////////////////////////////////////
   if(!DoorNumber) return res.status(400).send({doorNumbereMessage: "Door number is missing"});
   if(DoorNumber > 6) return res.status(400).send({doorNumbereMessage: "Door number is too high"});

   ////////////////////////////////////////////////////////////
   if(!PollutantClass) return res.status(400).send({pollutantClassMessage: "Pollutant class is missing"});
   if(!pollutantClassList.includes(PollutantClass)) return res.status(400).send({pollutantClassMessage: "Pollutant class is incorrect"});

   ////////////////////////////////////////////////////////////
   if(!Owners) return res.status(400).send({ownersMessage: "Number of owners is missing"});
   if(Owners > 10) return res.status(400).send({ownersMessage: "Number of owners is too high"});
   if(Owners < 0) return res.status(400).send({ownersMessage: "Number of owners cant be belove 0"});

   ////////////////////////////////////////////////////////////
   if(!ColorManufacturer) return res.status(400).send({colorManufacturerMessage: "Color(Manufacturer) is missing"});
   if(ColorManufacturer.length > 50) return res.status(400).send({colorManufacturerMessage: "Color(Manufacturer) characters length is too long (over 50 characters)"});

   ////////////////////////////////////////////////////////////
   if(!Color) return res.status(400).send({colorMessage: "Color is missing"});
   if(Color.length > 50) return res.status(400).send({colorMessage: "Color characters length is too long (over 50 characters)"});

   ////////////////////////////////////////////////////////////
   if(!Interior) return res.status(400).send({interiorMessage: "Interior type is missing"});
   if(Interior.length > 50) return res.status(400).send({interiorMessage: "Interior characters length is too long (over 50 characters)"});

   ////////////////////////////////////////////////////////////
   if (AditionalBio) {
      if(AditionalBio.length > 1000) return res.status(400).send({aditionalBioMessage: `Aditional data's max length is 1000 characters (current:${AditionalBio.length})`});
   }

   ////////////////////////////////////////////////////////////
   if (userTittle) {
      if (userTittle.length > 30) return res.status(400).send({userTittleMessage: "User bio too long (30 max characters)"});
   }

   ////////////////////////////////////////////////////////////
   let carOptionsArray = [];

   if (CarOptions) {
      if (Array.isArray(CarOptions)) {
          carOptionsArray = CarOptions;
      } else if (typeof CarOptions === 'string') {
          carOptionsArray = CarOptions.split(',').map(option => option.trim());
      } else {
          throw new Error('Invalid CarOptions format');
      }
   }

  if(!validateOptions(carOptionsArray)) return res.status(400).send({optionMessage: "Options dont exists"});

   ////////////////////////////////////////////////////////////

   let CarImages = [];

   try {
      const imageProcessingPromises = req.files.map(async (file) => {
         const buffer = await sharp(file.buffer)
            .resize({ height: 1080, width: 1920, fit: "cover" })
            .toBuffer();

         const imageName = randomImageName();
         
         const params = {
            Bucket: process.env.BUCKET_NAME,
            Key: imageName,
            Body: buffer,
            ContentType: file.mimetype,
         };

         const command = new PutObjectCommand(params);
         await s3.send(command);

         return imageName;
      });

      CarImages = await Promise.all(imageProcessingPromises);
   } catch (e) {
      console.log("Error processing images:", e);
      return res.status(500).send({ message: "Error processing images" });
   }
   try {
      const CreateNewCar = new Car({
        Seller, Brand, Model, Year, Mileage, Price, VehicleCondition, Category, Performance,
        Drivetrain, userTittle, DriveType, Fuel, VIN, TransmitionType, FirstRegistration,
        Registration, SeatNumber, DoorNumber, PollutantClass, Owners, ColorManufacturer, Color,
        Interior, CarOptions: carOptionsArray, CarImages, AditionalBio, ListingCreation: new Date(), 
      });

      const addCar = await CreateNewCar.save();

      res.status(201).send({message: "listing created"});
   } catch (e) {
      console.error("Error handling request:", error);
      res.status(400).send({e});
   }
});

// delete car

carsRouter.delete('/delete/:id', authMiddleware, roleMiddleware("CLIENT"), async (req, res) => {
   try {
       const { id } = req.params;
       const userIdToken = req.user._id.toString(); 

       const findCar = await Car.findById(id);

       if (!findCar) {
           return res.status(404).send({ message: 'Car not found' });
       }

       const findUser = await User.findById(findCar.Seller);

       if (!findUser) {
           return res.status(404).send({ message: 'User not found' });
       }

       if (findUser._id.toString() !== userIdToken) {
           return res.status(403).send({ message: 'Not authorized' });
       }

       const objectsToDelete = findCar.CarImages.map((key) => ({ Key: key }));

       const deleteParams = {
           Bucket: process.env.BUCKET_NAME,
           Delete: { Objects: objectsToDelete }
       };
       const deleteCommand = new DeleteObjectsCommand(deleteParams);
       await s3.send(deleteCommand);

       const deletedCar = await Car.findByIdAndDelete(id);

       res.status(200).send({ message: 'Car deleted successfully', deletedCar });
   } catch (error) {
       console.error('Error deleting car:', error);
       res.status(500).send({ error: 'An error occurred while deleting the car', details: error.message });
   }
});

// get recommended ////////////////////////////////////////////////////////////

carsRouter.get('/get/recommended', authMiddleware, roleMiddleware("GUEST"), async (req, res) => {
   const userRole = req.role;

   try {
      let recommendedCars = [];
      const maxCars = 5;

      if (userRole !== "GUEST") {
         const userIdToken = req.user._id;
         const userIdTokenString = userIdToken.toString();

         const recommended = await Recommended.findOne({ SelectedUser: userIdTokenString });

         if (recommended) {
            const randomBrand = recommended.Brand[Math.floor(Math.random() * recommended.Brand.length)];
            const randomModel = recommended.Model[Math.floor(Math.random() * recommended.Model.length)];

            recommendedCars = await getRandomCars({
               Brand: randomBrand,
               Model: randomModel,
            }, maxCars);
         }

         if (recommendedCars.length < maxCars) {
            const additionalCars = await getRandomCars(null, maxCars - recommendedCars.length);
            recommendedCars = [...recommendedCars, ...additionalCars];
         }
      } else {
         recommendedCars = await getRandomCars(null, maxCars);
      }

      res.status(200).send({ recommendedCars });
   } catch (error) {
      res.status(500).send({ error: 'An error occurred while fetching recommended cars', details: error.message });
   }
});
 
// get cars number ////////////////////////////////////////////////////////////

carsRouter.get('/get/number', authMiddleware, roleMiddleware("GUEST"), async (req, res) => {
   try {
       const totalCars = await Car.countDocuments();
       res.status(200).send({ totalCars });
   } catch (error) {
       console.error('Error fetching total number of cars:', error);
       res.status(500).send({ error: 'An error occurred while fetching the total number of cars', details: error.message });
   }
});

export default carsRouter;