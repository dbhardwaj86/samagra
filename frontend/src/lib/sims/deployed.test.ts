import { filterSims, groupByGrade } from "./deployed";
const rows = [
  { id: "0020", title: "Vector Lab", subject: "Physics", grade: "Class 11", url: "u1" },
  { id: "0466", title: "Osmosis Lab", subject: "Biology", grade: "Class 9", url: "u2" },
];
it("filters by title/subject/id", () => {
  expect(filterSims(rows, "osmo").map(r => r.id)).toEqual(["0466"]);
  expect(filterSims(rows, "physics").map(r => r.id)).toEqual(["0020"]);
  expect(filterSims(rows, "").length).toBe(2);
});
it("groups by grade", () => {
  const g = groupByGrade(rows);
  expect(g.map(x => x.grade).sort()).toEqual(["Class 11", "Class 9"]);
});
