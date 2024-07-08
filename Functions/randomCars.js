import { Car } from "../Models/carModel.js";
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { config } from "dotenv";
import multer from "multer";
config();

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

export const getRandomCars = async (query, size) => {
   try {
      if (!size || isNaN(size)) {
         throw new Error("Size argument must be a number");
      }

      let aggregationPipeline = [
         { $sample: { size: parseInt(size) } }
      ];

      if (query) {
         aggregationPipeline.unshift({ $match: query });
      }

      const randomCars = await Car.aggregate(aggregationPipeline).exec();
      for (const listing of randomCars) {
         for (let i = 0; i < listing.CarImages.length; i++) {
            const getObjectParams = {
               Bucket: process.env.BUCKET_NAME,
               Key: listing.CarImages[i], 
            };
      
            const command = new GetObjectCommand(getObjectParams);
            const url = await getSignedUrl(s3, command, { expiresIn: 3600 });
            listing.CarImages[i] = url; 
         }
      }
      return randomCars;
   } catch (error) {
      console.error("Error fetching random cars:", error);
      throw error;
   }
};