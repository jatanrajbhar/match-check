/*
 * Mock data. All people are fictional.
 *
 * The 25-row feedback history is sized to mirror the ratios in the brief:
 *   Matchmaker A ~45% acceptance, Matchmaker B ~21%, overall ~32%,
 *   ~35% of rejections are for a reason already in the client's stated preferences.
 * The "pool" profiles have not been sent yet; they are what the pre-send check runs on.
 */
(function (root) {
  "use strict";

  const clients = [
    {
      id: "c1", name: "Priya Sharma", age: 29, gender: "Woman", seeking: "Man", city: "Mumbai", matchmaker: "B",
      prefs: {
        age: [29, 35], heightCm: [175, null], cities: ["Mumbai", "Pune"], religions: ["Hindu"],
        minEducation: "Masters", maritalStatus: ["Never married"], diet: [],
      },
      dealBreakers: { smoking: "Never", drinking: "Socially", wantsChildren: "Yes" },
    },
    {
      id: "c2", name: "Sneha Iyer", age: 27, gender: "Woman", seeking: "Man", city: "Chennai", matchmaker: "B",
      prefs: {
        age: [27, 33], heightCm: null, cities: ["Chennai", "Bangalore"], religions: ["Hindu"],
        minEducation: "Bachelors", maritalStatus: ["Never married"], diet: ["Vegetarian", "Eggetarian"],
      },
      dealBreakers: { smoking: "Never", drinking: "Never", wantsChildren: "Yes" },
    },
    {
      id: "c3", name: "Aman Verma", age: 33, gender: "Man", seeking: "Woman", city: "Bangalore", matchmaker: "A",
      prefs: {
        age: [26, 32], heightCm: null, cities: ["Bangalore"], religions: [],
        minEducation: "Bachelors", maritalStatus: [], diet: ["Vegetarian", "Eggetarian", "Vegan"],
      },
      dealBreakers: { smoking: "Never", drinking: "Socially", wantsChildren: null },
    },
    {
      id: "c4", name: "Kabir Khan", age: 31, gender: "Man", seeking: "Woman", city: "Delhi", matchmaker: "A",
      prefs: {
        age: [25, 31], heightCm: null, cities: ["Delhi", "Gurgaon", "Noida"], religions: [],
        minEducation: "Masters", maritalStatus: [], diet: [],
      },
      dealBreakers: { smoking: "Occasionally", drinking: "Socially", wantsChildren: "Yes" },
    },
  ];

  // Columns: id, name, gender, age, heightCm, city, willingToRelocate, religion, education,
  //          maritalStatus, diet, smoking, drinking, wantsChildren, profession
  const rows = [
    // Already shared (feedback history)
    ["h1", "Rohan Kapoor", "Man", 37, 180, "Mumbai", false, "Hindu", "Masters", "Never married", "Non-vegetarian", "Never", "Socially", "Yes", "Investment banker"],
    ["h2", "Vikram Malhotra", "Man", 32, 178, "Mumbai", false, "Hindu", "Masters", "Never married", "Non-vegetarian", "Occasionally", "Socially", "Yes", "Product manager"],
    ["h3", "Aditya Rao", "Man", 31, 176, "Pune", false, "Hindu", "Masters", "Never married", "Vegetarian", "Never", "Socially", "Yes", "Architect"],
    ["h4", "Karan Mehra", "Man", 33, 182, "Mumbai", false, "Hindu", "Masters", "Never married", "Non-vegetarian", "Never", "Socially", "Yes", "Doctor"],
    ["h5", "Nikhil Desai", "Man", 30, 177, "Mumbai", false, "Hindu", "Masters", "Never married", "Vegetarian", "Never", "Never", "Yes", "Chartered accountant"],
    ["h6", "Arnav Gupta", "Man", 34, 179, "Mumbai", false, "Hindu", "Masters", "Never married", "Non-vegetarian", "Never", "Socially", "Yes", "Bank manager"],
    ["h7", "Rahul Iyer", "Man", 31, 180, "Pune", false, "Hindu", "Masters", "Never married", "Vegetarian", "Never", "Socially", "Yes", "Consultant"],
    ["h8", "Arjun Nair", "Man", 30, 172, "Chennai", false, "Hindu", "Bachelors", "Never married", "Vegetarian", "Never", "Regularly", "Yes", "Sales lead"],
    ["h9", "Karthik Subramanian", "Man", 32, 175, "Bangalore", false, "Hindu", "Masters", "Divorced", "Vegetarian", "Never", "Never", "Yes", "Engineer"],
    ["h10", "Pranav Raghavan", "Man", 29, 165, "Chennai", false, "Hindu", "Bachelors", "Never married", "Vegetarian", "Never", "Never", "Yes", "Teacher"],
    ["h11", "Varun Krishnan", "Man", 31, 168, "Bangalore", false, "Hindu", "Masters", "Never married", "Eggetarian", "Never", "Never", "Yes", "Data scientist"],
    ["h12", "Suresh Murthy", "Man", 30, 178, "Chennai", false, "Hindu", "Masters", "Never married", "Vegetarian", "Never", "Never", "Yes", "Civil engineer"],
    ["h13", "Deepak Venkat", "Man", 28, 174, "Chennai", false, "Hindu", "Bachelors", "Never married", "Vegetarian", "Never", "Never", "Yes", "Designer"],
    ["h14", "Ashwin Prakash", "Man", 31, 180, "Chennai", false, "Hindu", "Masters", "Never married", "Vegetarian", "Never", "Never", "Yes", "Research scientist"],
    ["h15", "Ananya Rao", "Woman", 28, 162, "Bangalore", false, "Hindu", "Masters", "Never married", "Vegetarian", "Never", "Socially", "Yes", "UX researcher"],
    ["h16", "Meera Pillai", "Woman", 30, 165, "Bangalore", false, "Christian", "Masters", "Never married", "Non-vegetarian", "Never", "Socially", "Yes", "Lawyer"],
    ["h17", "Ishita Bose", "Woman", 27, 158, "Bangalore", false, "Hindu", "Bachelors", "Never married", "Vegetarian", "Never", "Never", "Yes", "Marketing manager"],
    ["h18", "Riya Kulkarni", "Woman", 29, 163, "Bangalore", false, "Hindu", "Masters", "Never married", "Vegetarian", "Never", "Socially", "Open", "Startup founder"],
    ["h19", "Tanvi Shah", "Woman", 31, 160, "Bangalore", false, "Jain", "Masters", "Never married", "Vegetarian", "Never", "Never", "Yes", "Pharmacist"],
    ["h20", "Divya Menon", "Woman", 26, 166, "Bangalore", false, "Hindu", "Bachelors", "Never married", "Vegetarian", "Never", "Never", "Yes", "Analyst"],
    ["h21", "Sana Qureshi", "Woman", 27, 161, "Delhi", false, "Muslim", "Masters", "Never married", "Non-vegetarian", "Never", "Never", "Yes", "Journalist"],
    ["h22", "Neha Arora", "Woman", 29, 164, "Delhi", false, "Hindu", "Masters", "Never married", "Non-vegetarian", "Never", "Socially", "No", "Consultant"],
    ["h23", "Pooja Bhatia", "Woman", 28, 160, "Gurgaon", false, "Hindu", "Masters", "Never married", "Vegetarian", "Never", "Socially", "Yes", "HR lead"],
    ["h24", "Aisha Siddiqui", "Woman", 30, 167, "Delhi", false, "Muslim", "Doctorate", "Never married", "Non-vegetarian", "Never", "Socially", "Yes", "Professor"],
    ["h25", "Zara Ahmed", "Woman", 26, 159, "Noida", false, "Muslim", "Masters", "Never married", "Non-vegetarian", "Never", "Never", "Yes", "Software engineer"],
    // Not yet shared (the pool the matchmaker is about to send from)
    ["p1", "Ishaan Kapoor", "Man", 32, 181, "Mumbai", false, "Hindu", "Masters", "Never married", "Non-vegetarian", "Never", "Socially", "Yes", "Entrepreneur"],
    ["p2", "Dev Malhotra", "Man", 34, 183, "Mumbai", false, "Hindu", "Masters", "Never married", "Non-vegetarian", "Occasionally", "Socially", "Yes", "Lawyer"],
    ["p3", "Manish Joshi", "Man", 30, 177, "Pune", false, "Hindu", "Masters", "Never married", "Vegetarian", "Never", "Socially", "Yes", "Software architect"],
    ["p4", "Abhishek Nair", "Man", 29, 167, "Chennai", false, "Hindu", "Masters", "Never married", "Vegetarian", "Never", "Never", "Yes", "Doctor"],
    ["p5", "Vivek Raman", "Man", 31, 180, "Chennai", true, "Hindu", "Masters", "Never married", "Vegetarian", "Never", "Never", "Yes", "Product designer"],
    ["p6", "Sameer Reddy", "Man", 33, 176, "Bangalore", false, "Hindu", "Bachelors", "Never married", "Eggetarian", "Never", "Never", "Open", "Business owner"],
    ["p7", "Gaurav Shetty", "Man", 36, 178, "Mumbai", false, "Hindu", "Masters", "Divorced", "Non-vegetarian", "Never", "Socially", "Yes", "Film producer"],
    ["p8", "Nitin Agarwal", "Man", 31, null, "Mumbai", false, "Hindu", "Masters", "Never married", "Vegetarian", "Never", "Socially", "Yes", "Chartered accountant"],
    ["p9", "Kavya Reddy", "Woman", 28, 160, "Bangalore", false, "Hindu", "Masters", "Never married", "Vegetarian", "Never", "Socially", "Yes", "Product manager"],
    ["p10", "Simran Kaur", "Woman", 27, 165, "Gurgaon", false, "Sikh", "Masters", "Never married", "Non-vegetarian", "Never", "Socially", "Yes", "Brand strategist"],
    ["p11", "Fatima Sheikh", "Woman", 29, 163, "Delhi", false, "Muslim", "Masters", "Never married", "Non-vegetarian", "Never", "Never", "Yes", "Architect"],
    ["p12", "Nisha Gupta", "Woman", 30, 158, "Noida", false, "Hindu", "Masters", "Never married", "Vegetarian", "Never", "Socially", "No", "Investment analyst"],
    ["p13", "Rhea Fernandes", "Woman", 27, 168, "Bangalore", false, "Christian", "Bachelors", "Never married", "Non-vegetarian", "Never", "Socially", "Yes", "Chef"],
    ["p14", "Lavanya Srinivasan", "Woman", 31, 161, "Bangalore", true, "Hindu", "Masters", "Never married", "Vegan", "Never", "Never", "Open", "Data engineer"],
  ];

  const profiles = rows.map((r) => ({
    id: r[0], name: r[1], gender: r[2], age: r[3], heightCm: r[4], city: r[5], willingToRelocate: r[6],
    religion: r[7], education: r[8], maritalStatus: r[9], diet: r[10], smoking: r[11], drinking: r[12],
    wantsChildren: r[13], profession: r[14],
  }));

  // Client replies to profile emails over the last 30 days (free text, as received).
  const feedback = [
    ["c1", "h1", "2026-09-09", "rejected", "He's 37. I told you 35 max, that's way older than what I asked for."],
    ["c1", "h2", "2026-09-12", "rejected", "His profile says he smokes occasionally. I was very clear about no smoking."],
    ["c1", "h3", "2026-09-15", "rejected", "Seems nice, but Pune feels too far honestly. I'd prefer someone based in Mumbai."],
    ["c1", "h4", "2026-09-18", "accepted", "Looks great, happy to connect."],
    ["c1", "h5", "2026-09-22", "rejected", "Not really my type, the photos didn't do it for me."],
    ["c1", "h6", "2026-09-26", "rejected", "He's been in the same job for 10 years and doesn't seem very ambitious."],
    ["c1", "h7", "2026-10-02", "accepted", "He's in Pune but says he's in Mumbai every week for work. Happy to give it a go."],
    ["c2", "h8", "2026-09-10", "rejected", "His profile says he drinks regularly. I mentioned no drinking at all."],
    ["c2", "h9", "2026-09-13", "rejected", "He's divorced. I had mentioned never married only."],
    ["c2", "h10", "2026-09-17", "rejected", "He's 5'5, I'd like someone taller."],
    ["c2", "h11", "2026-09-21", "rejected", "Lovely profile but again, I want someone taller than me."],
    ["c2", "h12", "2026-09-24", "rejected", "He lives with a joint family and I want to live independently after marriage."],
    ["c2", "h13", "2026-09-29", "rejected", "Didn't feel any connection from his bio, it was very generic."],
    ["c2", "h14", "2026-10-03", "accepted", "Yes please! He sounds lovely."],
    ["c3", "h15", "2026-09-08", "accepted", "Great, please share my details."],
    ["c3", "h16", "2026-09-11", "rejected", "She eats non-veg. I had mentioned vegetarian only."],
    ["c3", "h17", "2026-09-16", "accepted", "Sounds interesting, yes."],
    ["c3", "h18", "2026-09-20", "rejected", "She works night shifts and wants to keep long hours, I'm looking for more work-life balance."],
    ["c3", "h19", "2026-09-25", "accepted", "Yes, happy to connect."],
    ["c3", "h20", "2026-09-30", "rejected", "Her bio felt generic, couldn't tell what she's like."],
    ["c4", "h21", "2026-09-09", "accepted", "Lovely, yes."],
    ["c4", "h22", "2026-09-14", "rejected", "She doesn't want kids. That's a deal-breaker for me, I definitely want children."],
    ["c4", "h23", "2026-09-19", "rejected", "She's in Gurgaon, the commute from South Delhi would be a pain."],
    ["c4", "h24", "2026-09-27", "rejected", "She's very into partying and I'm more of a homebody."],
    ["c4", "h25", "2026-10-04", "accepted", "Yes, let's go ahead."],
  ].map(([clientId, candidateId, date, decision, text], i) => ({
    id: `f${i + 1}`, clientId, candidateId, date, decision, text,
  }));

  const api = { clients, profiles, feedback };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.MatchData = api;
})(typeof window !== "undefined" ? window : globalThis);
