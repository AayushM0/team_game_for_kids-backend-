declare global {
  namespace Express {
    export interface Request {
      user?: {
        id: string;
        role: 'rider' | 'driver';
      };
    }
  }
}

declare module "jsonwebtoken";