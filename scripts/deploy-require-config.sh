#!/usr/bin/env bash
for name in PFOY_WORDPRESS_API_ROOT PFOY_PUBLIC_SITE_ORIGIN PFOY_CMS_ORIGIN PFOY_PUBLICATION_ACK_SECRET; do
  if [ -z "${!name}" ]; then
    echo "::error::Required publication configuration is missing: $name."
    exit 1
  fi
done
