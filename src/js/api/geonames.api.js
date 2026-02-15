import { CONFIG } from "../config";
import axios from "axios";

// Create a dedicated axios instance for Geonames API with the base URL and default parameters
const geonamesAxios = axios.create({
  baseURL: CONFIG.GEONAMES_BASE_URL,
  timeout: 10000,
  params: { username: CONFIG.GEONAMES_USERNAME },
});
