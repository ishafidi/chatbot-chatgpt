import express from 'express';
import cors from 'cors';
import OpenAI from "openai";
import axios from 'axios';

const openai = new OpenAI({ apiKey: "sk-J****************" });

const app = express();

// Set up middleware
app.use(cors());
app.use(express.json()); // Use express.json() for request body parsing

function excludeAttributes(jsonObj, attributesToExclude) {
  if (typeof jsonObj !== 'object' || !Array.isArray(attributesToExclude)) {
    return jsonObj;
  }

  for (const attr of attributesToExclude) {
    if (jsonObj.hasOwnProperty(attr)) {
      delete jsonObj[attr];
    }
  }

  for (const key in jsonObj) {
    if (typeof jsonObj[key] === 'object') {
      excludeAttributes(jsonObj[key], attributesToExclude);
    }
  }

  return jsonObj;
}



async function searchProducts(query) {
  try {
    const url = `https://wc071439b.api.esales.apptus.cloud/api/v2/panels/slp?esales.sessionKey=af8716a7-b9af-4cbe-b94a-7a7576c0915b&esales.customerKey=af8716a7-b9af-4cbe-b94a-7a7576c0915b&esales.market=SE&market_locale=sv_se&search_prefix=${query}&search_phrase=${query}`;

    const response = await axios.get(url);

    if (response.status === 200) {
      if (typeof response.data !== 'undefined') {
       const attributesToExclude = ['all_categories_codes', 'category_path','folder_rankings','v_available_size_options','nonProductSuggestions','autocomplete','v_gallery_images','v_size_filters','attributes','topSearches','didYouMean','v_available_size_codes','v_available_size_rate','v_categories_names','v_color_code','v_color_filter','v_fashion_image'];
       const modifiedJson = excludeAttributes(response.data, attributesToExclude);
       console.error(' modifiedJson response from Aptus Search Engine :'+JSON.stringify(modifiedJson));
        return modifiedJson;
      
      } else {
        console.error('Received an empty response from Aptus Search Engine');
        return null;
      }
    } else {
      console.error('Received an error response from Aptus Search Engine:', response.status, response.statusText);
      return null;
    }
  } catch (error) {
    console.error('An error occurred:', error);
    return null;
  }

}


app.post('/', async (req, res) => {
  try {
    const prompt = req.body.prompt;
    const messages = [
      { role: 'user', content: req.body.prompt },
    ];
    const functions = [
      {
        name: 'search_products',
        description: 'search products in the HM website example: looking for Tshirts, or any type of dress',
        parameters: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'The Dress or product that HM sales online, e.g., TShirt, iron-skjorta ',
            },
          },
          required: ['query'],
        },
      },
    ];

    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: messages,
      functions: functions,
      function_call: 'auto',
    }).catch((error) => {
      console.error('Error when calling OpenAI API:', error);
      res.status(500).json({ error: error.message });
      return;
    });

    const responseMessage = response.choices[0].message;


    if (responseMessage.function_call) {
      const availableFunctions = {
        search_products: searchProducts,
      };
      const functionName = responseMessage.function_call.name;
      const functionToCall = availableFunctions[functionName];
      const functionArgs = JSON.parse(responseMessage.function_call.arguments);

      const functionResponse = JSON.stringify( await searchProducts(functionArgs.query));
    
      
      // Step 4: send the info on the function call and function response to GPT
      console.log("############## RESONSE FROM APTUS WITH MODIFIED / REDUCES JSON "+functionResponse)
      messages.push(responseMessage);
      messages.push({
        "role": "function",
        "name": functionName,
        "content": functionResponse,
      });
      console.log("############# START Calling Chat GPT 2nd Time with response from APTUS " );
      const secondResponse = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: messages,
      });
      console.log(" ############ END OF Calling Chat GPT 2nd Time with response from APTUS " );
      console.log("############# CHAT GPT SECOND RESPONSE " + secondResponse.choices[0].message.content);
      res.status(200).send({
        bot: secondResponse.choices[0].message.content
      });
    } else {
      console.log("Received response from OpenAI: " + responseMessage.content);
      res.status(200).send({
        bot: responseMessage.content,
      });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(5000, () => console.log('AI server started on http://localhost:5000'));
