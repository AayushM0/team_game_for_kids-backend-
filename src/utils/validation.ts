import Joi from 'joi';

export const validatePhone = (phone: string): boolean => {
  // Indian phone number format: +91XXXXXXXXXX
  const phoneRegex = /^\+91[6-9][0-9]{9}$/;
  return phoneRegex.test(phone);
};

export const authSchemas = {
  sendOTP: Joi.object({
    phone: Joi.string().pattern(/^\+91[6-9][0-9]{9}$/).required().messages({
      'string.pattern.base': 'Phone number must be in Indian format: +91XXXXXXXXXX'
    }),
  }),
  
  verifyOTP: Joi.object({
    phone: Joi.string().pattern(/^\+91[6-9][0-9]{9}$/).required().messages({
      'string.pattern.base': 'Phone number must be in Indian format: +91XXXXXXXXXX'
    }),
    otp: Joi.string().length(6).required(),
    role: Joi.string().valid('rider', 'driver').required(),
    name: Joi.string().min(2).max(50).required(),
  }),
};

export const rideSchemas = {
  createRide: Joi.object({
    pickup: Joi.object({
      lat: Joi.number().required(),
      lng: Joi.number().required(),
      address: Joi.string().required(),
    }).required(),
    destination: Joi.object({
      lat: Joi.number().required(),
      lng: Joi.number().required(),
      address: Joi.string().required(),
    }).required(),
    rideType: Joi.string().valid('lite', 'city', 'plus').required(),
  }),
};

export const driverSchemas = {
  updateStatus: Joi.object({
    isOnline: Joi.boolean().required(),
  }),
  
  updateLocation: Joi.object({
    lat: Joi.number().required(),
    lng: Joi.number().required(),
  }),
};
