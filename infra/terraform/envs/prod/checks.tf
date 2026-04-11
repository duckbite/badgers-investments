# ACM + API Gateway require hostnames on names Terraform can manage in the created zone.
check "hosts_under_dns_zone" {
  assert {
    condition     = local.hostnames_under_zone
    error_message = "web_domain and api_domain must equal dns_zone_name or be a hostname under it (e.g. dns_zone_name=badgers.nl, web_domain=investments.badgers.nl)."
  }
}
