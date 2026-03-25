const { Country, State, City } = require("country-state-city");

/**
 * Location Controller — API-based location data using country-state-city.
 * Provides countries, states, and cities for cascading location dropdowns.
 */

/**
 * GET /api/jobs/meta/countries
 * Returns all countries.
 */
const getCountries = async (req, res) => {
  try {
    const countries = Country.getAllCountries().map((c) => ({
      name: c.name,
      isoCode: c.isoCode,
      flag: c.flag,
    }));

    res.status(200).json({
      success: true,
      data: countries,
    });
  } catch (error) {
    console.error("Error fetching countries:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch countries",
    });
  }
};

/**
 * GET /api/jobs/meta/states?countryCode=IN
 * Returns states for a given country.
 */
const getStates = async (req, res) => {
  try {
    const { countryCode } = req.query;

    if (!countryCode) {
      return res.status(400).json({
        success: false,
        error: "countryCode is required",
      });
    }

    const states = State.getStatesOfCountry(countryCode).map((s) => ({
      name: s.name,
      isoCode: s.isoCode,
      countryCode: s.countryCode,
    }));

    res.status(200).json({
      success: true,
      data: states,
    });
  } catch (error) {
    console.error("Error fetching states:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch states",
    });
  }
};

/**
 * GET /api/jobs/meta/cities?countryCode=IN&stateCode=KA
 * Returns cities for a given state.
 */
const getCities = async (req, res) => {
  try {
    const { countryCode, stateCode } = req.query;

    if (!countryCode || !stateCode) {
      return res.status(400).json({
        success: false,
        error: "countryCode and stateCode are required",
      });
    }

    const cities = City.getCitiesOfState(countryCode, stateCode).map((c) => ({
      name: c.name,
      stateCode: c.stateCode,
      countryCode: c.countryCode,
    }));

    res.status(200).json({
      success: true,
      data: cities,
    });
  } catch (error) {
    console.error("Error fetching cities:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch cities",
    });
  }
};

module.exports = { getCountries, getStates, getCities };
