const path = require('path');
const fs = require('fs');
require(path.join(__dirname, '../backend/node_modules/dotenv')).config({ path: path.join(__dirname, '../backend/.env') });
const mongoose = require(path.join(__dirname, '../backend/node_modules/mongoose'));
const bcrypt = require(path.join(__dirname, '../backend/node_modules/bcryptjs'));

const mongoModels = require('../backend/src/models/mongo');
const uri = (process.env.MONGODB_URI || '').trim();

const LOCATION_DIR = path.resolve(__dirname, '../location-data');
const DB_JSON_PATH = path.resolve(__dirname, '../backend/data/database.json');

const readLocationJson = (filename) => {
  const fp = path.join(LOCATION_DIR, filename);
  if (fs.existsSync(fp)) {
    return JSON.parse(fs.readFileSync(fp, 'utf-8'));
  }
  return [];
};

const DEPARTMENTS_30 = [
  { id: 1, name: 'Police & Law Enforcement', code: 'POL', head_name: 'Superintendent Rajesh Verma', contact_email: 'police.dept@civic.gov.in', description: 'Theft, assault, robbery, public violence, missing persons, law and order' },
  { id: 2, name: 'Cyber Crime', code: 'CYB', head_name: 'Inspector Meera Sen', contact_email: 'cyber.crime@civic.gov.in', description: 'Online financial fraud, UPI scam, phishing, account hacking, cyber harassment' },
  { id: 3, name: 'Women & Child Safety', code: 'WCS', head_name: 'Officer Ananya Roy', contact_email: 'women.safety@civic.gov.in', description: 'Street harassment, domestic violence, child abuse, stalking, victim protection' },
  { id: 4, name: 'Traffic & Road Safety', code: 'TRS', head_name: 'Inspector Vikram Singh', contact_email: 'traffic.safety@civic.gov.in', description: 'Dangerous driving, traffic signals, obstructive parking, road safety enforcement' },
  { id: 5, name: 'Roads & Public Works', code: 'PWD', head_name: 'Dr. Alok Mukherjee', contact_email: 'roads.pwd@civic.gov.in', description: 'Potholes, broken roads, damaged bridges, flyovers, road surface engineering' },
  { id: 6, name: 'Drainage & Sewerage', code: 'DSB', head_name: 'Er. Subrata Pal', contact_email: 'drainage.sewerage@civic.gov.in', description: 'Open manholes, sewage overflow, blocked drains, monsoon waterlogging' },
  { id: 7, name: 'Water Supply', code: 'WSD', head_name: 'Er. Debasis Das', contact_email: 'water.supply@civic.gov.in', description: 'Pipeline bursts, contaminated tap water, drinking water scarcity, water tankers' },
  { id: 8, name: 'Solid Waste Management', code: 'SWM', head_name: 'Ms. Sunita Banerjee', contact_email: 'solid.waste@civic.gov.in', description: 'Garbage dumping, missed collections, overflowing bins, composting, bio-waste' },
  { id: 9, name: 'Street Lighting & Electrical', code: 'SLE', head_name: 'Er. Rajesh Roy', contact_email: 'street.lighting@civic.gov.in', description: 'Broken streetlights, dangling cables, high-mast illumination, pole repairs' },
  { id: 10, name: 'Public Health & Sanitation', code: 'PHS', head_name: 'Dr. Manoj Mondal', contact_email: 'public.health@civic.gov.in', description: 'Mosquito breeding, dengue control, public toilets, food market hygiene' },
  { id: 11, name: 'Fire & Emergency Services', code: 'FES', head_name: 'Chief Fire Officer S. K. Bose', contact_email: 'fire.emergency@civic.gov.in', description: 'Fire hazards, blocked emergency exits, fire hydrants, commercial fire safety' },
  { id: 12, name: 'Disaster Management', code: 'DMA', head_name: 'Officer Pradip Nandi', contact_email: 'disaster.mgmt@civic.gov.in', description: 'Severe flood response, cyclone tree falls, building collapse, emergency relief' },
  { id: 13, name: 'Environment & Pollution', code: 'ENP', head_name: 'Dr. Sharmistha Guha', contact_email: 'env.pollution@civic.gov.in', description: 'Industrial air smoke, chemical effluents, noise pollution, water contamination' },
  { id: 14, name: 'Parks & Public Spaces', code: 'PPS', head_name: 'Ms. Ritu Sen', contact_email: 'parks.spaces@civic.gov.in', description: 'Children playgrounds, municipal parks, broken benches, public recreation grounds' },
  { id: 15, name: 'Building & Municipal Engineering', code: 'BME', head_name: 'Er. Tanmoy Dutta', contact_email: 'building.eng@civic.gov.in', description: 'Illegal construction, structurally unsound buildings, unauthorized floor additions' },
  { id: 16, name: 'Land & Land Records', code: 'LLR', head_name: 'Officer Bikas Chatterjee', contact_email: 'land.records@civic.gov.in', description: 'Government land encroachment, illegal property mutation, forged land deeds' },
  { id: 17, name: 'Housing & Urban Development', code: 'HUD', head_name: 'Er. Nilanjan Ghosh', contact_email: 'housing.urban@civic.gov.in', description: 'Affordable housing defects, slum rehabilitation, urban master plan implementation' },
  { id: 18, name: 'Electricity & Power', code: 'ELP', head_name: 'Er. Amitava Ghosh', contact_email: 'electricity.power@civic.gov.in', description: 'Distribution transformers, high-tension lines, power outages, voltage stability' },
  { id: 19, name: 'Public Transport', code: 'PTR', head_name: 'Director Amitabha Basu', contact_email: 'public.transport@civic.gov.in', description: 'Municipal buses, route schedules, bus shelters, commuter grievances' },
  { id: 20, name: 'Railway-related Public Complaints', code: 'RPC', head_name: 'Liaison Officer Kalyan Das', contact_email: 'railway.complaints@civic.gov.in', description: 'Station approach sanitation, level crossing safety, passenger amenities' },
  { id: 21, name: 'Health & Hospitals', code: 'HNH', head_name: 'Dr. Arunima Sanyal', contact_email: 'health.hospitals@civic.gov.in', description: 'Government hospital services, emergency medicines, clinic infrastructure' },
  { id: 22, name: 'Food & Public Distribution', code: 'FPD', head_name: 'Officer Soumen Barik', contact_email: 'food.distribution@civic.gov.in', description: 'Ration shop pricing, grain quality, fair price shops, public distribution' },
  { id: 23, name: 'Consumer Affairs', code: 'COA', head_name: 'Advocate Snehasis Dey', contact_email: 'consumer.affairs@civic.gov.in', description: 'Charging above MRP, warranty refusal, counterfeit goods, unfair trade practices' },
  { id: 24, name: 'Education - Schools', code: 'EDS', head_name: 'Dr. Kaushik Maitra', contact_email: 'education.schools@civic.gov.in', description: 'Primary and high school infrastructure, classroom safety, drinking water, toilets' },
  { id: 25, name: 'Higher Education', code: 'HED', head_name: 'Prof. Debabrata Roy', contact_email: 'higher.education@civic.gov.in', description: 'Colleges, universities, campus facilities, examination scheduling, anti-ragging' },
  { id: 26, name: 'Labour & Employment', code: 'LAE', head_name: 'Officer Tanuja Mitra', contact_email: 'labour.employment@civic.gov.in', description: 'Unpaid wages, construction workplace safety, minimum wage compliance' },
  { id: 27, name: 'Agriculture', code: 'AGR', head_name: 'Dr. Partha Sarathi Roy', contact_email: 'agriculture.dept@civic.gov.in', description: 'Irrigation canals, crop damage surveys, seed quality, farmer subsidies' },
  { id: 28, name: 'Animal Resources', code: 'ANR', head_name: 'Dr. Sujit Karmakar (DVM)', contact_email: 'animal.resources@civic.gov.in', description: 'Stray animal management, dog bite control, rabies vaccination, injured livestock' },
  { id: 29, name: 'Forest & Wildlife', code: 'FAW', head_name: 'Divisional Forest Officer R. K. Singh', contact_email: 'forest.wildlife@civic.gov.in', description: 'Illegal tree cutting, timber smuggling, wildlife rescue, green belt conservation' },
  { id: 30, name: 'Public Grievance / General Administration', code: 'PGA', head_name: 'Deputy Commissioner P. K. Mallick', contact_email: 'public.grievance@civic.gov.in', description: 'Certificate delays, official corruption complaints, citizen charter compliance' }
];

const passwordHash = bcrypt.hashSync('password123', 10);

const ALL_30_OFFICERS = [
  { id: 1, dept_id: 1, email: 'officer.police@demo.com', name: 'Superintendent Rajesh Verma', role: 'police_officer', ward: 'Ward 1', phone: '+91 98301 10001' },
  { id: 2, dept_id: 2, email: 'officer.cyber@demo.com', name: 'Inspector Meera Sen', role: 'cyber_crime_officer', ward: 'Ward 2', phone: '+91 98301 10002' },
  { id: 3, dept_id: 3, email: 'officer.women@demo.com', name: 'Officer Ananya Roy', role: 'officer', ward: 'Ward 3', phone: '+91 98301 10003' },
  { id: 4, dept_id: 4, email: 'officer.traffic@demo.com', name: 'Inspector Vikram Singh', role: 'officer', ward: 'Ward 4', phone: '+91 98301 10004' },
  { id: 5, dept_id: 5, email: 'officer.pwd@demo.com', name: 'Dr. Alok Mukherjee', role: 'officer', ward: 'Ward 5', phone: '+91 98301 10005' },
  { id: 6, dept_id: 6, email: 'officer.drainage@demo.com', name: 'Er. Subrata Pal', role: 'officer', ward: 'Ward 6', phone: '+91 98301 10006' },
  { id: 7, dept_id: 7, email: 'officer.water@demo.com', name: 'Er. Debasis Das', role: 'officer', ward: 'Ward 7', phone: '+91 98301 10007' },
  { id: 8, dept_id: 8, email: 'officer.solidwaste@demo.com', name: 'Ms. Sunita Banerjee', role: 'officer', ward: 'Ward 8', phone: '+91 98301 10008' },
  { id: 9, dept_id: 9, email: 'officer.streetlighting@demo.com', name: 'Er. Rajesh Roy', role: 'officer', ward: 'Ward 9', phone: '+91 98301 10009' },
  { id: 10, dept_id: 10, email: 'officer.health@demo.com', name: 'Dr. Manoj Mondal', role: 'officer', ward: 'Ward 10', phone: '+91 98301 10010' },
  { id: 11, dept_id: 11, email: 'officer.fire@demo.com', name: 'Chief Fire Officer S. K. Bose', role: 'officer', ward: 'Ward 11', phone: '+91 98301 10011' },
  { id: 12, dept_id: 12, email: 'officer.disaster@demo.com', name: 'Officer Pradip Nandi', role: 'officer', ward: 'Ward 12', phone: '+91 98301 10012' },
  { id: 13, dept_id: 13, email: 'officer.environment@demo.com', name: 'Dr. Sharmistha Guha', role: 'officer', ward: 'Ward 13', phone: '+91 98301 10013' },
  { id: 14, dept_id: 14, email: 'officer.parks@demo.com', name: 'Ms. Ritu Sen', role: 'officer', ward: 'Ward 14', phone: '+91 98301 10014' },
  { id: 15, dept_id: 15, email: 'officer.building@demo.com', name: 'Er. Tanmoy Dutta', role: 'officer', ward: 'Ward 15', phone: '+91 98301 10015' },
  { id: 16, dept_id: 16, email: 'officer.land@demo.com', name: 'Officer Bikas Chatterjee', role: 'officer', ward: 'Ward 16', phone: '+91 98301 10016' },
  { id: 17, dept_id: 17, email: 'officer.housing@demo.com', name: 'Er. Nilanjan Ghosh', role: 'officer', ward: 'Ward 17', phone: '+91 98301 10017' },
  { id: 18, dept_id: 18, email: 'officer.electricity@demo.com', name: 'Er. Amitava Ghosh', role: 'officer', ward: 'Ward 18', phone: '+91 98301 10018' },
  { id: 19, dept_id: 19, email: 'officer.transport@demo.com', name: 'Director Amitabha Basu', role: 'officer', ward: 'Ward 19', phone: '+91 98301 10019' },
  { id: 20, dept_id: 20, email: 'officer.railway@demo.com', name: 'Liaison Officer Kalyan Das', role: 'officer', ward: 'Ward 20', phone: '+91 98301 10020' },
  { id: 21, dept_id: 21, email: 'officer.hospital@demo.com', name: 'Dr. Arunima Sanyal', role: 'officer', ward: 'Ward 1', phone: '+91 98301 10021' },
  { id: 22, dept_id: 22, email: 'officer.food@demo.com', name: 'Officer Soumen Barik', role: 'officer', ward: 'Ward 2', phone: '+91 98301 10022' },
  { id: 23, dept_id: 23, email: 'officer.consumer@demo.com', name: 'Advocate Snehasis Dey', role: 'officer', ward: 'Ward 3', phone: '+91 98301 10023' },
  { id: 24, dept_id: 24, email: 'officer.school@demo.com', name: 'Dr. Kaushik Maitra', role: 'officer', ward: 'Ward 4', phone: '+91 98301 10024' },
  { id: 25, dept_id: 25, email: 'officer.higheredu@demo.com', name: 'Prof. Debabrata Roy', role: 'officer', ward: 'Ward 5', phone: '+91 98301 10025' },
  { id: 26, dept_id: 26, email: 'officer.labour@demo.com', name: 'Officer Tanuja Mitra', role: 'officer', ward: 'Ward 6', phone: '+91 98301 10026' },
  { id: 27, dept_id: 27, email: 'officer.agriculture@demo.com', name: 'Dr. Partha Sarathi Roy', role: 'officer', ward: 'Ward 7', phone: '+91 98301 10027' },
  { id: 28, dept_id: 28, email: 'officer.animal@demo.com', name: 'Dr. Sujit Karmakar (DVM)', role: 'officer', ward: 'Ward 8', phone: '+91 98301 10028' },
  { id: 29, dept_id: 29, email: 'officer.forest@demo.com', name: 'DFO R. K. Singh', role: 'officer', ward: 'Ward 9', phone: '+91 98301 10029' },
  { id: 30, dept_id: 30, email: 'officer.grievance@demo.com', name: 'Deputy Commissioner P. K. Mallick', role: 'officer', ward: 'Ward 10', phone: '+91 98301 10030' }
];

const ADMIN_AND_CITIZEN_USERS = [
  { id: 100, dept_id: null, email: 'admin@demo.com', name: 'Pritam Ghosh (Admin)', role: 'admin', ward: 'Ward 1', phone: '+91 98765 43210' },
  { id: 101, dept_id: null, email: 'citizen@demo.com', name: 'Rahul Sharma (Citizen)', role: 'citizen', ward: 'Ward 4', phone: '+91 98111 22334' },
  { id: 102, dept_id: null, email: 'citizen.priya@demo.com', name: 'Priya Sen (Citizen)', role: 'citizen', ward: 'Ward 8', phone: '+91 98222 33445' },
  { id: 103, dept_id: null, email: 'citizen.amit@demo.com', name: 'Amit Roy (Citizen)', role: 'citizen', ward: 'Ward 12', phone: '+91 98333 44556' },
  { id: 104, dept_id: 6, email: 'officer.drain@demo.com', name: 'Officer Tanvi Sen (Drainage)', role: 'officer', ward: 'Ward 5', phone: '+91 98304 44556' }
];

const ALL_USERS = [...ALL_30_OFFICERS, ...ADMIN_AND_CITIZEN_USERS].map(u => ({
  id: u.id,
  name: u.name,
  email: u.email.toLowerCase().trim(),
  password_hash: passwordHash,
  role: u.role,
  phone: u.phone,
  department_id: u.dept_id,
  ward: u.ward,
  created_at: new Date(),
  updated_at: new Date()
}));

async function resetAndInitializeDatabase() {
  console.log('\x1b[35m%s\x1b[0m', '=======================================================');
  console.log('\x1b[35m%s\x1b[0m', '🔥 CIVICPULSE AI — COMPLETE DATABASE RESET & INIT');
  console.log('\x1b[35m%s\x1b[0m', '=======================================================\n');

  if (!uri) {
    console.error('✗ Error: MONGODB_URI not found in backend/.env');
    process.exit(1);
  }

  try {
    console.log('⚡ Connecting to MongoDB Atlas...');
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 15000 });
    console.log('✓ Connected to MongoDB Atlas.\n');

    // 1. Drop or clear all collections
    console.log('🗑️  Purging all existing collections...');
    const collectionsToClear = [
      mongoModels.Complaint,
      mongoModels.ComplaintTimeline,
      mongoModels.ComplaintEvidence,
      mongoModels.VisualAnalysis,
      mongoModels.EvidenceAuditLog,
      mongoModels.Notification,
      mongoModels.Feedback,
      mongoModels.Counter,
      mongoModels.User,
      mongoModels.Department,
      mongoModels.District,
      mongoModels.Subdivision,
      mongoModels.ULB,
      mongoModels.Ward,
      mongoModels.Block,
      mongoModels.GramPanchayat,
      mongoModels.VillageMouza,
      mongoModels.PoliceStation,
      mongoModels.Postcode
    ];

    for (const model of collectionsToClear) {
      if (model && model.deleteMany) {
        await model.deleteMany({});
      }
    }
    console.log('✓ All collections emptied successfully.\n');

    // 2. Seed 30 Departments
    console.log('🏛️  Seeding 30 Municipal & State Departments...');
    await mongoModels.Department.insertMany(DEPARTMENTS_30);
    console.log(`✓ Seeded ${DEPARTMENTS_30.length} Departments.`);

    // 3. Seed Users
    console.log('👥 Seeding 35 System Users (Admin, 30 Officers, Citizens)...');
    await mongoModels.User.insertMany(ALL_USERS);
    console.log(`✓ Seeded ${ALL_USERS.length} Users.`);

    // 4. Seed Location Data
    console.log('📍 Seeding Official West Bengal Location Hierarchy...');
    const districts = readLocationJson('districts.json');
    if (districts.length > 0) {
      await mongoModels.District.insertMany(districts);
      console.log(`✓ Seeded ${districts.length} Districts.`);
    }

    const subdivisions = readLocationJson('subdivisions.json');
    if (subdivisions.length > 0) {
      await mongoModels.Subdivision.insertMany(subdivisions);
      console.log(`✓ Seeded ${subdivisions.length} Subdivisions.`);
    }

    const ulbs = readLocationJson('urban_local_bodies.json');
    if (ulbs.length > 0) {
      await mongoModels.ULB.insertMany(ulbs);
      console.log(`✓ Seeded ${ulbs.length} Urban Local Bodies.`);
    }

    const wards = readLocationJson('wards.json');
    if (wards.length > 0) {
      await mongoModels.Ward.insertMany(wards);
      console.log(`✓ Seeded ${wards.length} Wards.`);
    }

    const blocks = readLocationJson('blocks.json');
    if (blocks.length > 0) {
      await mongoModels.Block.insertMany(blocks);
      console.log(`✓ Seeded ${blocks.length} CD Blocks.`);
    }

    const gramPanchayats = readLocationJson('gram_panchayats.json');
    if (gramPanchayats.length > 0) {
      await mongoModels.GramPanchayat.insertMany(gramPanchayats);
      console.log(`✓ Seeded ${gramPanchayats.length} Gram Panchayats.`);
    }

    const villagesMouzas = readLocationJson('villages_mouzas.json');
    if (villagesMouzas.length > 0) {
      await mongoModels.VillageMouza.insertMany(villagesMouzas);
      console.log(`✓ Seeded ${villagesMouzas.length} Villages & Mouzas.`);
    }

    const policeStations = readLocationJson('police_stations.json');
    if (policeStations.length > 0) {
      await mongoModels.PoliceStation.insertMany(policeStations);
      console.log(`✓ Seeded ${policeStations.length} Police Stations.`);
    }

    const postcodes = readLocationJson('postcodes.json');
    if (postcodes.length > 0) {
      await mongoModels.Postcode.insertMany(postcodes);
      console.log(`✓ Seeded ${postcodes.length} Postcodes.`);
    }

    // 5. Initialize Sequence Counters
    console.log('\n🔢 Resetting sequence counters...');
    const initialCounters = [
      { _id: 'departments', seq: 31 },
      { _id: 'users', seq: 105 },
      { _id: 'complaints', seq: 1 },
      { _id: 'complaint_timeline', seq: 1 },
      { _id: 'feedback', seq: 1 },
      { _id: 'notifications', seq: 1 },
      { _id: 'complaint_evidence', seq: 1 },
      { _id: 'visual_analyses', seq: 1 },
      { _id: 'evidence_audit_logs', seq: 1 }
    ];

    for (const c of initialCounters) {
      await mongoModels.Counter.findByIdAndUpdate(
        c._id,
        { $set: { seq: c.seq } },
        { upsert: true }
      );
    }
    console.log('✓ Counters initialized.');

    // 6. Ensure 2dsphere index on Complaint
    console.log('🌐 Building 2dsphere and unique indexes...');
    await mongoModels.Complaint.collection.createIndex({ location: '2dsphere' });
    await mongoModels.Complaint.collection.createIndex({ tracking_id: 1 }, { unique: true });
    await mongoModels.User.collection.createIndex({ email: 1 }, { unique: true });
    console.log('✓ Indexes built.');

    // 7. Synchronize local relational file database.json
    console.log('\n💾 Mirroring clean structure to local backend/data/database.json...');
    const cleanDb = {
      departments: DEPARTMENTS_30,
      users: ALL_USERS,
      complaints: [],
      complaint_timeline: [],
      feedback: [],
      notifications: [],
      complaint_evidence: [],
      visual_analyses: [],
      evidence_audit_logs: [],
      districts,
      subdivisions,
      ulbs,
      wards,
      blocks,
      gram_panchayats: gramPanchayats,
      villages_mouzas: villagesMouzas,
      police_stations: policeStations,
      postcodes,
      _counters: {
        departments: 31,
        users: 105,
        complaints: 1,
        complaint_timeline: 1,
        feedback: 1,
        notifications: 1,
        complaint_evidence: 1,
        visual_analyses: 1,
        evidence_audit_logs: 1,
        districts: districts.length + 1,
        subdivisions: subdivisions.length + 1,
        ulbs: ulbs.length + 1,
        wards: wards.length + 1,
        blocks: blocks.length + 1,
        gram_panchayats: gramPanchayats.length + 1,
        villages_mouzas: villagesMouzas.length + 1,
        police_stations: policeStations.length + 1
      }
    };

    fs.writeFileSync(DB_JSON_PATH, JSON.stringify(cleanDb, null, 2), 'utf-8');
    console.log('✓ database.json synchronized with fresh structure.');

    // 8. Final Count Verification
    const counts = {
      departments: await mongoModels.Department.countDocuments(),
      users: await mongoModels.User.countDocuments(),
      districts: await mongoModels.District.countDocuments(),
      subdivisions: await mongoModels.Subdivision.countDocuments(),
      ulbs: await mongoModels.ULB.countDocuments(),
      wards: await mongoModels.Ward.countDocuments(),
      blocks: await mongoModels.Block.countDocuments(),
      gramPanchayats: await mongoModels.GramPanchayat.countDocuments(),
      villagesMouzas: await mongoModels.VillageMouza.countDocuments(),
      policeStations: await mongoModels.PoliceStation.countDocuments(),
      postcodes: await mongoModels.Postcode.countDocuments(),
      complaints: await mongoModels.Complaint.countDocuments(),
      timelines: await mongoModels.ComplaintTimeline.countDocuments(),
      notifications: await mongoModels.Notification.countDocuments()
    };

    console.log('\n\x1b[32m%s\x1b[0m', '=======================================================');
    console.log('\x1b[32m%s\x1b[0m', '🎉 DATABASE RESET & RE-INITIALIZATION COMPLETE!');
    console.log('\x1b[32m%s\x1b[0m', '=======================================================');
    console.table([
      { 'Entity / Collection': 'Departments', 'MongoDB Documents': counts.departments, 'Status': 'Ready' },
      { 'Entity / Collection': 'Users (Admin + 30 Officers + Citizens)', 'MongoDB Documents': counts.users, 'Status': 'Ready' },
      { 'Entity / Collection': 'Districts', 'MongoDB Documents': counts.districts, 'Status': 'Ready' },
      { 'Entity / Collection': 'Subdivisions', 'MongoDB Documents': counts.subdivisions, 'Status': 'Ready' },
      { 'Entity / Collection': 'Urban Local Bodies (ULBs)', 'MongoDB Documents': counts.ulbs, 'Status': 'Ready' },
      { 'Entity / Collection': 'Wards', 'MongoDB Documents': counts.wards, 'Status': 'Ready' },
      { 'Entity / Collection': 'CD Blocks', 'MongoDB Documents': counts.blocks, 'Status': 'Ready' },
      { 'Entity / Collection': 'Gram Panchayats', 'MongoDB Documents': counts.gramPanchayats, 'Status': 'Ready' },
      { 'Entity / Collection': 'Villages / Mouzas', 'MongoDB Documents': counts.villagesMouzas, 'Status': 'Ready' },
      { 'Entity / Collection': 'Police Stations', 'MongoDB Documents': counts.policeStations, 'Status': 'Ready' },
      { 'Entity / Collection': 'Postcodes', 'MongoDB Documents': counts.postcodes, 'Status': 'Ready' },
      { 'Entity / Collection': 'Complaints', 'MongoDB Documents': counts.complaints, 'Status': 'Clean Slate (0)' },
      { 'Entity / Collection': 'Timelines', 'MongoDB Documents': counts.timelines, 'Status': 'Clean Slate (0)' },
      { 'Entity / Collection': 'Notifications', 'MongoDB Documents': counts.notifications, 'Status': 'Clean Slate (0)' }
    ]);

    await mongoose.disconnect();
    console.log('\n✓ Disconnected from MongoDB Atlas. Safe to restart server.');
    process.exit(0);
  } catch (err) {
    console.error('\n✗ Error during database reset:', err);
    process.exit(1);
  }
}

resetAndInitializeDatabase();
