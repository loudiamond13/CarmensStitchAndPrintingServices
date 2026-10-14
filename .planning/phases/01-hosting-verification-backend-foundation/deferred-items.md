## Deferred Items

- Health tests skip their Content-Type assertion when the header is missing
  status: open
  **Found during:** 01-06 Task 1. The same pattern hid a missing Content-Type in this plan's first RED run.
  **What:** `tests/Csps.Server.IntegrationTests/Health/HealthEndpointTests.cs:25` and `HealthEndpointFailureTests.cs:95` use `response.Content.Headers.ContentType?.MediaType.ShouldBe("application/json")`. The `?.` stops the whole chain, `ShouldBe` included, when `ContentType` is null, so a response with no Content-Type still passes.
  **Fix:** use `ContentType.ShouldNotBeNull().MediaType.ShouldBe(...)`, as `tests/Csps.Server.IntegrationTests/Http/ProblemJson.cs` does. This is out of 01-06's scope (plan 01-03's tests), so it was logged here and not changed.
