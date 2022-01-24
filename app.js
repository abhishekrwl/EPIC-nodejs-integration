const http = require('http');
const express = require('express');
const app = express();
require('dotenv').config();
const bodyParser = require('body-parser');
const axios = require('axios');
const cors = require('cors');
const FormData = require('form-data');

app.use(bodyParser.json({limit: "50mb"}))
app.use(bodyParser.urlencoded({extended: true}))
app.use(cors());

app.get('/', (req, res) => {
    console.log(`First Route!`);
    res.send(`First Route!`)
})

app.get(`/auth/epic/callback`, async (req,res) => {
    console.log(req.query)
    if(req.query.code){
        return res.redirect(`/get/auth/token?code=${req.query.code}`)
    }
    let iss = req.query.iss;
    let launch = req.query.launch;
    let headers = {
        headers: {
            Accept: `application/fhir+json`
        }
    }

    // for R4 `${iss}/.well-known/smart-configuration`
    // for DSTU `${iss}/metadata`

    let response = await axios.get(`${iss}/metadata`, headers)
    .then(data => {
        // console.log(data.data.rest[0]);
        return JSON.stringify(data.data);
    })
    .catch(e => {
        console.log('error occured');
    })
    response = JSON.parse(response)
    if(!response || !response.rest || !response.rest[0] || !response.rest[0].security || !response.rest[0].security.extension)
    {
        return res.send('Error in find of URLs')
    }
    let extensionArray = response.rest[0].security.extension[0].extension;
    console.log(extensionArray)
    let authorization_endpoint = ''
    let token_endpoint = ''
    for(let value of extensionArray){
        if(value.url == `authorize`){
            authorization_endpoint = value.valueUri
        }
        if(value.url == `token`){
            token_endpoint = value.valueUri
        }
    }
    console.log(authorization_endpoint);
    console.log(token_endpoint)

    let redirectURL = `${authorization_endpoint}?response_type=code&client_id=${process.env.SMART_CLIENT_ID}&redirect_uri=${process.env.BASE_URL}auth/epic/callback&state=1234&scope=patient.read, patient.search, observation.read (Core Characteristics)`
    // &scope=launch`
    console.log(redirectURL);
    return res.redirect(redirectURL);
    // res.send(response);
})

app.get('/get/auth/token', async (req,res) => {
    console.log('working here------------------->');
    let code = req.query.code;

    var data = new FormData();
    data.append('client_id', '8eec27bf-da6c-4cb2-8e8c-16abadb02102');
    data.append('grant_type', 'authorization_code');
    data.append('code', `${code}`);
    data.append('redirect_uri', 'http://localhost:3001/auth/epic/callback');
    data.append("state", "1234");

    var config = {
    method: 'post',
    url: 'https://fhir.epic.com/interconnect-fhir-oauth/oauth2/token',
    headers: { 
        'Content-Type': 'application/x-www-form-urlencoded', 
        ...data.getHeaders()
    },
    data : data
    };

    let details = await axios(config)
    .then(function (response) {
        return JSON.stringify(response.data);
    })
    .catch(function (error) {
        console.log('error occured');
    });

    details = JSON.parse(details);
    console.log(details);
    let access_token = details.access_token
    let patient = details.patient

    let url = `https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4/Patient/${patient}`
    // url = `https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4/Observation?patient=${patient}`
    
    var config = {
        method: 'get',
        url: url,
        headers: { 
          'Authorization': `Bearer ${access_token}`
        }
    };
    
    let patientData = await axios(config)
    .then(function (response) {
        return JSON.stringify(response.data);
    })
    .catch(function (error) {
        console.log(error);
    });
    res.send(JSON.parse(patientData));
    // res.send(details);
})

app.get('/auth/epic/callback/normal', (req,res) => {
    console.log('working here')
    let response = {
        query: req.query,
        body: req.body
    }
    if(req.query.code){
        return res.redirect(`/get/auth/token?code=${req.query.code}`)
    }
    return res.send(response)
})

// https://fhir.epic.com/interconnect-fhir-oauth/oauth2/authorize?response_type=code&redirect_uri=http://localhost:3001/auth/epic/callback&client_id=8eec27bf-da6c-4cb2-8e8c-16abadb02102&state=1234&scope=patient.read, patient.search

const server = http.createServer(app);
server.listen(3001, () => {
    console.log(`server is running on port 3001!`)
})