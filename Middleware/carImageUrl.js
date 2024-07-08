import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { Car } from "../Models/carModel.js";
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

export const carImageUrlSearch = async (query, id) => {
   let listings = [];

    if (id) {
        const listing = await Car.findById(id);
        if (listing) {
            listings.push(listing);
        }
    } else {
        listings = await Car.find(query);
    }
      for (const listing of listings) {
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
      return listings;
}
